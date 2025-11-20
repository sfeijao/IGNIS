const logger = require('./logger');

/**
 * Processar array em batches com concorrência controlada
 * @param {Array} items - Items para processar
 * @param {Function} processor - Async function que processa cada item
 * @param {Object} options - Opções
 * @returns {Promise<Array>} Resultados
 */
async function processBatch(items, processor, options = {}) {
    const {
        batchSize = 10,
        concurrency = 3,
        onProgress = null,
        stopOnError = false
    } = options;

    const results = [];
    const errors = [];
    let processed = 0;

    // Dividir em batches
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        // Processar batch com concorrência limitada
        const promises = [];
        for (let j = 0; j < batch.length; j += concurrency) {
            const chunk = batch.slice(j, j + concurrency);

            const chunkPromises = chunk.map(async (item, idx) => {
                try {
                    const result = await processor(item, i + j + idx);
                    processed++;

                    if (onProgress) {
                        onProgress(processed, items.length, result);
                    }

                    return { success: true, result, item };
                } catch (error) {
                    logger.warn(`[BatchProcessor] Error processing item ${i + j + idx}:`, error.message);
                    errors.push({ item, error, index: i + j + idx });

                    if (stopOnError) {
                        throw error;
                    }

                    return { success: false, error, item };
                }
            });

            promises.push(...chunkPromises);
        }

        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
    }

    return {
        results: results.filter(r => r.success).map(r => r.result),
        errors,
        total: items.length,
        succeeded: results.filter(r => r.success).length,
        failed: errors.length
    };
}

/**
 * Bulk insert com batching automático
 * @param {Model} Model - Mongoose model
 * @param {Array} documents - Documentos para inserir
 * @param {Object} options - Opções
 * @returns {Promise<Object>} Resultado
 */
async function bulkInsert(Model, documents, options = {}) {
    const {
        batchSize = 100,
        ordered = false,
        onProgress = null
    } = options;

    const results = [];
    const errors = [];
    let inserted = 0;

    for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);

        try {
            const result = await Model.insertMany(batch, { ordered });
            inserted += result.length;
            results.push(...result);

            if (onProgress) {
                onProgress(inserted, documents.length);
            }
        } catch (error) {
            // insertMany pode falhar parcialmente em modo não-ordenado
            if (error.insertedDocs) {
                inserted += error.insertedDocs.length;
                results.push(...error.insertedDocs);
            }

            logger.warn(`[BulkInsert] Batch ${i}-${i + batchSize} partial failure:`, error.message);
            errors.push({ batch: i, error });

            if (ordered) {
                throw error; // Stop em modo ordenado
            }
        }
    }

    return {
        inserted: results,
        total: documents.length,
        succeeded: inserted,
        failed: documents.length - inserted,
        errors
    };
}

/**
 * Bulk update com batching
 * @param {Model} Model - Mongoose model
 * @param {Array} updates - Array de { filter, update }
 * @param {Object} options - Opções
 * @returns {Promise<Object>} Resultado
 */
async function bulkUpdate(Model, updates, options = {}) {
    const {
        batchSize = 50,
        onProgress = null
    } = options;

    let modified = 0;
    let matched = 0;

    for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);

        const bulkOps = batch.map(({ filter, update, upsert = false }) => ({
            updateOne: {
                filter,
                update,
                upsert
            }
        }));

        try {
            const result = await Model.bulkWrite(bulkOps, { ordered: false });
            modified += result.modifiedCount || 0;
            matched += result.matchedCount || 0;

            if (onProgress) {
                onProgress(i + batch.length, updates.length);
            }
        } catch (error) {
            logger.error(`[BulkUpdate] Batch ${i}-${i + batchSize} failed:`, error.message);
        }
    }

    return {
        total: updates.length,
        matched,
        modified
    };
}

/**
 * Executar operações em paralelo com retry
 * @param {Array} operations - Array de funções async
 * @param {Object} options - Opções
 * @returns {Promise<Array>} Resultados
 */
async function parallelWithRetry(operations, options = {}) {
    const {
        maxConcurrency = 5,
        maxRetries = 2,
        retryDelay = 1000
    } = options;

    const results = [];
    const queue = [...operations];
    const active = new Set();

    async function executeWithRetry(op, retries = 0) {
        try {
            return await op();
        } catch (error) {
            if (retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay * (retries + 1)));
                return executeWithRetry(op, retries + 1);
            }
            throw error;
        }
    }

    while (queue.length > 0 || active.size > 0) {
        // Preencher pool até maxConcurrency
        while (queue.length > 0 && active.size < maxConcurrency) {
            const op = queue.shift();
            const promise = executeWithRetry(op)
                .then(result => {
                    active.delete(promise);
                    return { success: true, result };
                })
                .catch(error => {
                    active.delete(promise);
                    return { success: false, error };
                });

            active.add(promise);
        }

        // Esperar por pelo menos uma operação completar
        if (active.size > 0) {
            const result = await Promise.race(active);
            results.push(result);
        }
    }

    return results;
}

module.exports = {
    processBatch,
    bulkInsert,
    bulkUpdate,
    parallelWithRetry
};

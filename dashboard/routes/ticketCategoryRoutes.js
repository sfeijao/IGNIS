const express = require('express');
const router = express.Router();
const { TicketCategoryModel } = require('../../utils/db/models');

/**
 * 🎫 TICKET CATEGORY ROUTES
 *
 * Gerenciamento de categorias customizáveis de tickets por servidor.
 * Permite criar, editar, reordenar e deletar categorias.
 */

// ========================================
// LISTAR CATEGORIAS DE UM SERVIDOR
// ========================================
router.get('/guild/:gid/ticket-categories', async (req, res) => {
  try {
    const { gid } = req.params;

    // Validação básica
    if (!gid || !/^\d+$/.test(gid)) {
      return res.status(400).json({
        error: 'Invalid guild ID format'
      });
    }

    // Buscar categorias ordenadas
    const categories = await TicketCategoryModel
      .find({ guild_id: gid })
      .sort({ order: 1 })
      .lean();

    return res.json({
      success: true,
      count: categories.length,
      categories
    });

  } catch (error) {
    console.error('[TicketCategories] Error fetching categories:', error);
    return res.status(500).json({
      error: 'Failed to fetch ticket categories',
      details: error.message
    });
  }
});

// ========================================
// CRIAR NOVA CATEGORIA
// ========================================
router.post('/guild/:gid/ticket-categories', async (req, res) => {
  try {
    const { gid } = req.params;
    const { name, emoji, description, color } = req.body;

    // Validações
    if (!gid || !/^\d+$/.test(gid)) {
      return res.status(400).json({ error: 'Invalid guild ID' });
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: 'Category name must have at least 2 characters'
      });
    }

    if (name.length > 50) {
      return res.status(400).json({
        error: 'Category name must be 50 characters or less'
      });
    }

    // Validar emoji (formato Discord)
    if (emoji && !/^(<a?:\w+:\d+>|[\p{Emoji}])$/u.test(emoji)) {
      return res.status(400).json({
        error: 'Invalid emoji format'
      });
    }

    // Validar cor (hex válido)
    if (color && (typeof color !== 'number' || color < 0 || color > 0xFFFFFF)) {
      return res.status(400).json({
        error: 'Invalid color value (must be 0x000000 to 0xFFFFFF)'
      });
    }

    // Verificar limite de categorias (máx 25 por servidor)
    const existingCount = await TicketCategoryModel.countDocuments({
      guild_id: gid
    });

    if (existingCount >= 25) {
      return res.status(400).json({
        error: 'Maximum 25 categories per server reached'
      });
    }

    // Obter próxima ordem disponível
    const maxOrder = await TicketCategoryModel
      .findOne({ guild_id: gid })
      .sort({ order: -1 })
      .select('order')
      .lean();

    const nextOrder = maxOrder ? maxOrder.order + 1 : 0;

    // Criar categoria
    const category = await TicketCategoryModel.create({
      guild_id: gid,
      name: name.trim(),
      emoji: emoji || '📩',
      description: description?.trim() || '',
      color: color || 0x7C3AED,
      order: nextOrder,
      enabled: true
    });

    console.log(`[TicketCategories] Created category "${name}" for guild ${gid}`);

    return res.status(201).json({
      success: true,
      category
    });

  } catch (error) {
    console.error('[TicketCategories] Error creating category:', error);
    return res.status(500).json({
      error: 'Failed to create ticket category',
      details: error.message
    });
  }
});

// ========================================
// ATUALIZAR CATEGORIA EXISTENTE
// ========================================
router.patch('/guild/:gid/ticket-categories/:id', async (req, res) => {
  try {
    const { gid, id } = req.params;
    const { name, emoji, description, color, enabled } = req.body;

    // Validações
    if (!gid || !/^\d+$/.test(gid)) {
      return res.status(400).json({ error: 'Invalid guild ID' });
    }

    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    // Construir update object
    const updateData = { updated_at: new Date() };

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          error: 'Category name must have at least 2 characters'
        });
      }
      if (name.length > 50) {
        return res.status(400).json({
          error: 'Category name must be 50 characters or less'
        });
      }
      updateData.name = name.trim();
    }

    if (emoji !== undefined) {
      if (!/^(<a?:\w+:\d+>|[\p{Emoji}])$/u.test(emoji)) {
        return res.status(400).json({ error: 'Invalid emoji format' });
      }
      updateData.emoji = emoji;
    }

    if (description !== undefined) {
      updateData.description = description.trim();
    }

    if (color !== undefined) {
      if (typeof color !== 'number' || color < 0 || color > 0xFFFFFF) {
        return res.status(400).json({
          error: 'Invalid color value'
        });
      }
      updateData.color = color;
    }

    if (enabled !== undefined) {
      updateData.enabled = Boolean(enabled);
    }

    // Atualizar categoria
    const category = await TicketCategoryModel.findOneAndUpdate(
      { _id: id, guild_id: gid },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        error: 'Category not found'
      });
    }

    console.log(`[TicketCategories] Updated category ${id} for guild ${gid}`);

    return res.json({
      success: true,
      category
    });

  } catch (error) {
    console.error('[TicketCategories] Error updating category:', error);
    return res.status(500).json({
      error: 'Failed to update ticket category',
      details: error.message
    });
  }
});

// ========================================
// REORDENAR CATEGORIAS
// ========================================
router.post('/guild/:gid/ticket-categories/reorder', async (req, res) => {
  try {
    const { gid } = req.params;
    const { order } = req.body; // Array de IDs na nova ordem

    // Validações
    if (!gid || !/^\d+$/.test(gid)) {
      return res.status(400).json({ error: 'Invalid guild ID' });
    }

    if (!Array.isArray(order)) {
      return res.status(400).json({
        error: 'Order must be an array of category IDs'
      });
    }

    // Validar que todos IDs são válidos
    const invalidIds = order.filter(id => !/^[a-f\d]{24}$/i.test(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        error: 'Invalid category ID(s) in order array'
      });
    }

    // Verificar que todas categorias pertencem ao servidor
    const categories = await TicketCategoryModel.find({
      _id: { $in: order },
      guild_id: gid
    }).lean();

    if (categories.length !== order.length) {
      return res.status(400).json({
        error: 'Some categories do not exist or do not belong to this guild'
      });
    }

    // Atualizar ordem de cada categoria
    const bulkOps = order.map((id, index) => ({
      updateOne: {
        filter: { _id: id, guild_id: gid },
        update: { $set: { order: index, updated_at: new Date() } }
      }
    }));

    await TicketCategoryModel.bulkWrite(bulkOps);

    console.log(`[TicketCategories] Reordered ${order.length} categories for guild ${gid}`);

    // Retornar categorias atualizadas
    const updatedCategories = await TicketCategoryModel
      .find({ guild_id: gid })
      .sort({ order: 1 })
      .lean();

    return res.json({
      success: true,
      categories: updatedCategories
    });

  } catch (error) {
    console.error('[TicketCategories] Error reordering categories:', error);
    return res.status(500).json({
      error: 'Failed to reorder ticket categories',
      details: error.message
    });
  }
});

// ========================================
// DELETAR CATEGORIA
// ========================================
router.delete('/guild/:gid/ticket-categories/:id', async (req, res) => {
  try {
    const { gid, id } = req.params;

    // Validações
    if (!gid || !/^\d+$/.test(gid)) {
      return res.status(400).json({ error: 'Invalid guild ID' });
    }

    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    // Deletar categoria
    const result = await TicketCategoryModel.findOneAndDelete({
      _id: id,
      guild_id: gid
    });

    if (!result) {
      return res.status(404).json({
        error: 'Category not found'
      });
    }

    console.log(`[TicketCategories] Deleted category ${id} for guild ${gid}`);

    // Reordenar categorias restantes
    const remainingCategories = await TicketCategoryModel
      .find({ guild_id: gid })
      .sort({ order: 1 })
      .lean();

    // Atualizar ordem sequencial
    if (remainingCategories.length > 0) {
      const bulkOps = remainingCategories.map((cat, index) => ({
        updateOne: {
          filter: { _id: cat._id },
          update: { $set: { order: index } }
        }
      }));

      await TicketCategoryModel.bulkWrite(bulkOps);
    }

    return res.json({
      success: true,
      message: 'Category deleted successfully',
      deleted_id: id
    });

  } catch (error) {
    console.error('[TicketCategories] Error deleting category:', error);
    return res.status(500).json({
      error: 'Failed to delete ticket category',
      details: error.message
    });
  }
});

module.exports = router;

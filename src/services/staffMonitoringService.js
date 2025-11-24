const { StaffAction } = require('../models/staffAction');

class StaffMonitoringService {
    async logAction(guildId, staffId, actionType, targetId, reason = 'Não especificado', metadata = {}) {
        return await StaffAction.create({
            guildId,
            staffId,
            actionType,
            targetId,
            reason,
            metadata
        });
    }
    
    async getStaffStats(guildId, staffId, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const actions = await StaffAction.find({
            guildId,
            staffId,
            timestamp: { $gte: startDate }
        });
        
        const stats = {
            total: actions.length,
            byType: {},
            recentActions: actions.slice(-10).reverse()
        };
        
        actions.forEach(action => {
            stats.byType[action.actionType] = (stats.byType[action.actionType] || 0) + 1;
        });
        
        return stats;
    }
    
    async getLeaderboard(guildId, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const actions = await StaffAction.find({
            guildId,
            timestamp: { $gte: startDate }
        });
        
        const staffMap = new Map();
        
        actions.forEach(action => {
            if (!staffMap.has(action.staffId)) {
                staffMap.set(action.staffId, { total: 0, byType: {} });
            }
            
            const staffData = staffMap.get(action.staffId);
            staffData.total++;
            staffData.byType[action.actionType] = (staffData.byType[action.actionType] || 0) + 1;
        });
        
        return Array.from(staffMap.entries())
            .map(([staffId, data]) => ({ staffId, ...data }))
            .sort((a, b) => b.total - a.total);
    }
    
    async getUserActionHistory(guildId, targetId, limit = 20) {
        return await StaffAction.find({ guildId, targetId })
            .sort({ timestamp: -1 })
            .limit(limit);
    }
    
    async getRecentActions(guildId, limit = 50) {
        return await StaffAction.find({ guildId })
            .sort({ timestamp: -1 })
            .limit(limit);
    }
}

module.exports = new StaffMonitoringService();

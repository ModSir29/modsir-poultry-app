// Completely Rewritten FarmDB to use Firebase Firestore Cloud Database
// Achieves Stage 5 real-time sync and multi-tenant isolation via window.currentFarmId

window.FarmDB = {
    // We no longer need a manual init promise because Firebase handles connection states.
    init: async function() {
        console.log("Firebase DB initialized (via compat).");
        return Promise.resolve();
    },
    
    // --- Helper to get the correct collection reference ---
    _getCollectionRef: function(storeName) {
        if (!window.currentFarmId) throw new Error("User not authenticated or Farm ID missing.");
        // Data Structure: /farms/{farmId}/{storeName}/{documentId}
        return db.collection('farms').doc(window.currentFarmId).collection(storeName);
    },

    // --- Create Methods ---
    addRecord: async function(storeName, data) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.createdBy = window.currentUser ? window.currentUser.uid : 'unknown';
        
        const ref = this._getCollectionRef(storeName);
        return ref.add(data);
    },

    // --- Update Method ---
    updateRecord: async function(storeName, docId, data) {
        data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        data.updatedBy = window.currentUser ? window.currentUser.uid : 'unknown';
        
        const ref = this._getCollectionRef(storeName);
        return ref.doc(docId).update(data);
    },

    // --- Delete Method ---
    deleteRecord: async function(storeName, docId) {
        const ref = this._getCollectionRef(storeName);
        return ref.doc(docId).delete();
    },

    // --- Read Methods ---
    getAll: async function(storeName) {
        // We might query this right after login, ensure FarmId exists.
        if(!window.currentFarmId) return [];
        
        const ref = this._getCollectionRef(storeName);
        const snapshot = await ref.orderBy('createdAt', 'desc').get();
        
        const results = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id; // Map document ID
            
            // Format Timestamp to local string if it exists
            if(data.createdAt && data.createdAt.toDate) {
                data.createdDate = data.createdAt.toDate().toLocaleDateString();
            } else {
                data.createdDate = '-';
            }
            results.push(data);
        });
        
        return results;
    },

    // --- Quick Stats for Dashboard (Now using Cloud Data) ---
    getDashboardStats: async function() {
        if(!window.currentFarmId) return { broilers:0, layers:0, feedStock:0, mortalityRate: 0, profit:0, incomeStr: 0, totalDead:0 };

        try {
            // In a production app, we would use Cloud Functions for aggregations, but for this prototype,
            // fetching all relevant documents is okay for small-to-medium datasets.
            const [batches, flocks, feedPurchases, feedUsage, mortality, expenses, income, sales, vaccines] = await Promise.all([
                this.getAll('batches'),
                this.getAll('flocks'),
                this.getAll('feedPurchases'),
                this.getAll('feedUsage'),
                this.getAll('mortality'),
                this.getAll('expenses'),
                this.getAll('income'),
                this.getAll('sales'),
                this.getAll('vaccines')
            ]);
            
            let initialBroilers = batches.reduce((sum, b) => sum + parseInt(b.numChicks || 0), 0);
            let initialLayers = flocks.reduce((sum, f) => sum + parseInt(f.numBirds || 0), 0);
            
            // Mortality Split
            let deadBroilers = mortality.filter(m => m.type === 'broiler').reduce((s,m)=>s+parseInt(m.deaths || 0),0);
            let deadLayers = mortality.filter(m => m.type === 'layer').reduce((s,m)=>s+parseInt(m.deaths || 0),0);
            
            // Sales Split
            let soldBroilers = sales.filter(s => s.itemType === 'Broilers').reduce((s, b) => s + parseInt(b.quantity || 0), 0);
            let soldLayers = sales.filter(s => s.itemType === 'Layers').reduce((s, l) => s + parseInt(l.quantity || 0), 0);

            let currentBroilers = Math.max(0, initialBroilers - deadBroilers - soldBroilers);
            let currentLayers = Math.max(0, initialLayers - deadLayers - soldLayers);

            // Feed Split (Starter/Grower/Finisher = Broilers, Layer Mash = Layers)
            const isBroilerFeed = (type) => ['Starter', 'Grower', 'Finisher'].includes(type);
            const isLayerFeed = (type) => ['Layer Mash'].includes(type);
            
            let broilerFeedBought = feedPurchases.filter(p => isBroilerFeed(p.type)).reduce((s, p) => s + parseInt(p.bags || 0), 0);
            let layerFeedBought = feedPurchases.filter(p => isLayerFeed(p.type)).reduce((s, p) => s + parseInt(p.bags || 0), 0);
            let broilerFeedUsed = feedUsage.filter(u => isBroilerFeed(u.type)).reduce((s, u) => s + parseInt(u.bagsUsed || 0), 0);
            let layerFeedUsed = feedUsage.filter(u => isLayerFeed(u.type)).reduce((s, u) => s + parseInt(u.bagsUsed || 0), 0);
            
            let broilerFeedStock = Math.max(0, broilerFeedBought - broilerFeedUsed);
            let layerFeedStock = Math.max(0, layerFeedBought - layerFeedUsed);

            // Financial Split
            let broilerIncome = sales.filter(s => s.itemType === 'Broilers').reduce((s, sObj) => s + parseFloat(sObj.totalPrice || 0), 0);
            let layerIncome = sales.filter(s => ['Layers', 'Eggs'].includes(s.itemType)).reduce((s, sObj) => s + parseFloat(sObj.totalPrice || 0), 0);
            
            // We split standard expenses evenly as overhead, or attribute specific ones if we wanted to. We'll split generic expenses 50/50.
            let genericExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) / 2;
            
            let broilerExpenses = genericExpenses 
                + feedPurchases.filter(p => isBroilerFeed(p.type)).reduce((s, p) => s + (parseFloat(p.bags || 0) * parseFloat(p.costPerBag || 0)), 0)
                + batches.reduce((sum, b) => sum + (parseInt(b.numChicks || 0) * parseFloat(b.costPerChick || 0)), 0);
                
            let layerExpenses = genericExpenses 
                + feedPurchases.filter(p => isLayerFeed(p.type)).reduce((s, p) => s + (parseFloat(p.bags || 0) * parseFloat(p.costPerBag || 0)), 0);
            
            let broilerProfit = broilerIncome - broilerExpenses;
            let layerProfit = layerIncome - layerExpenses;

            return {
                broilers: currentBroilers,
                layers: currentLayers,
                
                broilerFeedStock: broilerFeedStock,
                layerFeedStock: layerFeedStock,
                
                broilerMortalityRate: initialBroilers === 0 ? 0 : ((deadBroilers / initialBroilers) * 100).toFixed(1),
                layerMortalityRate: initialLayers === 0 ? 0 : ((deadLayers / initialLayers) * 100).toFixed(1),
                
                broilerProfit: broilerProfit,
                layerProfit: layerProfit,
                
                broilerIncomeStr: broilerIncome,
                layerIncomeStr: layerIncome,
                
                vaccineData: vaccines
            };
        } catch (e) {
            console.error("Failed calculating stats:", e);
            throw e;
        }
    }
};

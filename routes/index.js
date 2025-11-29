// routes/index.js - SIMPLIFIED VERSION
const authRoutes = require('./authRoutes');
const assetRoutes = require('./assetRoutes');
const loanRoutes = require('./loansRoutes');

// Untuk sementara, comment yang belum ada
// const reportRoutes = require('./reports');
// const returnRoutes = require('./returns');
// const dashboardRoutes = require('./dashboard');

const routes = [].concat(
  authRoutes,
  assetRoutes, 
  loanRoutes
  // reportRoutes,
  // returnRoutes,
  // dashboardRoutes
);

console.log('🔄 Registered routes:');
routes.forEach(route => {
  console.log(`   ${route.method} ${route.path}`);
});

module.exports = routes;
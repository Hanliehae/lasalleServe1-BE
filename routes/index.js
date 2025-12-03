// routes/index.js
const authRoutes = require('./authRoutes');
const assetRoutes = require('./assetRoutes');
const loanRoutes = require('./loansRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const reportRoutes = require('./reportsRoutes');
const returnRoutes = require('./returnRoutes');
const exportRoutes = require('./exportRoutes'); // ✅ Tambahkan ini

const routes = [].concat(
  authRoutes,
  assetRoutes, 
  loanRoutes,
  dashboardRoutes,
  reportRoutes,
  returnRoutes,
  exportRoutes // ✅ Tambahkan ini
);

console.log('🔄 Registered routes:');
routes.forEach(route => {
  console.log(`   ${route.method} ${route.path}`);
});

module.exports = routes;
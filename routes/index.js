// routes/index.js - PERBAIKI dengan tambahkan console log untuk debug
const authRoutes = require('./authRoutes');
const assetRoutes = require('./assetRoutes');
const loanRoutes = require('./loansRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const reportRoutes = require('./reportsRoutes');
const returnRoutes = require('./returnRoutes');
const exportRoutes = require('./exportRoutes');
const uploadRoutes = require('./uploadRoutes');

const routes = [].concat(
  authRoutes,
  assetRoutes,
  loanRoutes,
  dashboardRoutes,
  reportRoutes,
  returnRoutes,
  exportRoutes,
  uploadRoutes
);

console.log('\n🔄 Registered routes with methods:');
routes.forEach(route => {
  console.log(`   ${route.method} ${route.path}`);
});

module.exports = routes;
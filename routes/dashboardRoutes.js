// routes/dashboardRoutes.js
const DashboardController = require('../controllers/dashboardController');

const dashboardRoutes = [
  {
    method: 'GET',
    path: '/api/dashboard/stats',
    handler: DashboardController.getStats
  },
  {
    method: 'GET',
    path: '/api/dashboard/activities',
    handler: DashboardController.getRecentActivity
  }
];

module.exports = dashboardRoutes;
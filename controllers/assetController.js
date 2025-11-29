const { query } = require('../config/database');

class AssetController {
  static async getAssets(request, h) {
    try {
      const { search, category } = request.query;
      
      let sql = `
        SELECT 
          id, name, category, location, total_stock as "totalStock", 
          available_stock as "availableStock", condition, description,
          acquisition_year as "acquisitionYear", created_at as "createdAt"
        FROM assets 
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 0;

      if (search) {
        paramCount++;
        sql += ` AND (name ILIKE $${paramCount} OR location ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      if (category && category !== 'all') {
        paramCount++;
        sql += ` AND category = $${paramCount}`;
        params.push(category);
      }

      sql += ' ORDER BY name';

      const result = await query(sql, params);

      return h.response({
        status: 'success',
        data: {
          assets: result.rows
        }
      });
    } catch (error) {
      console.error('Get assets error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }

  static async getAssetById(request, h) {
    try {
      const { id } = request.params;

      const result = await query(
        `SELECT 
          id, name, category, location, total_stock as "totalStock", 
          available_stock as "availableStock", condition, description,
          acquisition_year as "acquisitionYear", created_at as "createdAt"
         FROM assets WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return h.response({
          status: 'error',
          message: 'Asset tidak ditemukan'
        }).code(404);
      }

      return h.response({
        status: 'success',
        data: {
          asset: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Get asset by id error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }

  static async createAsset(request, h) {
    try {
      const {
        name,
        category,
        location,
        totalStock,
        availableStock,
        condition,
        description,
        acquisitionYear
      } = request.payload;

      const result = await query(
        `INSERT INTO assets (name, category, location, total_stock, available_stock, condition, description, acquisition_year)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, name, category, location, total_stock as "totalStock", 
                   available_stock as "availableStock", condition, description,
                   acquisition_year as "acquisitionYear", created_at as "createdAt"`,
        [name, category, location, totalStock, availableStock, condition, description, acquisitionYear]
      );

      return h.response({
        status: 'success',
        data: {
          asset: result.rows[0]
        }
      }).code(201);
    } catch (error) {
      console.error('Create asset error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }

  static async updateAsset(request, h) {
    try {
      const { id } = request.params;
      const {
        name,
        category,
        location,
        totalStock,
        availableStock,
        condition,
        description,
        acquisitionYear
      } = request.payload;

      const result = await query(
        `UPDATE assets 
         SET name = $1, category = $2, location = $3, total_stock = $4, 
             available_stock = $5, condition = $6, description = $7, 
             acquisition_year = $8, updated_at = CURRENT_TIMESTAMP
         WHERE id = $9
         RETURNING id, name, category, location, total_stock as "totalStock", 
                   available_stock as "availableStock", condition, description,
                   acquisition_year as "acquisitionYear", created_at as "createdAt"`,
        [name, category, location, totalStock, availableStock, condition, description, acquisitionYear, id]
      );

      if (result.rows.length === 0) {
        return h.response({
          status: 'error',
          message: 'Asset tidak ditemukan'
        }).code(404);
      }

      return h.response({
        status: 'success',
        data: {
          asset: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Update asset error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }

  static async deleteAsset(request, h) {
    try {
      const { id } = request.params;

      const result = await query(
        'DELETE FROM assets WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return h.response({
          status: 'error',
          message: 'Asset tidak ditemukan'
        }).code(404);
      }

      return h.response({
        status: 'success',
        message: 'Asset berhasil dihapus'
      });
    } catch (error) {
      console.error('Delete asset error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }
}

module.exports = AssetController;
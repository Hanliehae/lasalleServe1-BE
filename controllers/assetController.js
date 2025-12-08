// controllers/assetController.js - PERBAIKI QUERY
const { query, getClient } = require('../config/database');

class AssetController {
  static async getAssets(request, h) {
    try {
      const { search, category, availableOnly } = request.query;
      
      let sql = `
        SELECT 
          a.id, 
          a.name, 
          a.category, 
          a.location, 
          a.description,
          a.acquisition_year as "acquisitionYear", 
          a.semester,
          a.total_stock as "totalStock", 
          a.available_stock as "availableStock",
          a.created_at as "createdAt", 
          a.updated_at as "updatedAt",
          COALESCE(
            json_agg(
              json_build_object(
                'condition', ac.condition,
                'quantity', ac.quantity
              )
            ) FILTER (WHERE ac.condition IS NOT NULL),
            '[]'
          ) as conditions
        FROM assets a
        LEFT JOIN asset_conditions ac ON a.id = ac.asset_id
        WHERE 1=1
      `;
      
      const params = [];
      let paramCount = 0;

      if (search) {
        paramCount++;
        sql += ` AND (a.name ILIKE $${paramCount} OR a.location ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      if (category && category !== 'all') {
        paramCount++;
        sql += ` AND a.category = $${paramCount}`;
        params.push(category);
      }

      if (availableOnly === 'true') {
        paramCount++;
        sql += ` AND a.available_stock > 0`;
      }

      sql += ' GROUP BY a.id ORDER BY a.created_at DESC';

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
        message: 'Terjadi kesalahan server: ' + error.message
      }).code(500);
    }
  }

  static async getAssetById(request, h) {
    try {
      const { id } = request.params;

      const result = await query(
        `SELECT 
          a.id, a.name, a.category, a.location, a.description,
          a.acquisition_year as "acquisitionYear", a.semester,
          a.total_stock as "totalStock", a.available_stock as "availableStock",
          a.created_at as "createdAt", a.updated_at as "updatedAt",
          COALESCE(
            json_agg(
              json_build_object(
                'condition', ac.condition,
                'quantity', ac.quantity
              )
            ) FILTER (WHERE ac.condition IS NOT NULL),
            '[]'
          ) as conditions
         FROM assets a
         LEFT JOIN asset_conditions ac ON a.id = ac.asset_id
         WHERE a.id = $1
         GROUP BY a.id`,
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
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      const {
        name,
        category,
        location,
        description,
        acquisitionYear,
        semester,
        conditions,

      } = request.payload;

      // Validasi minimal ada satu kondisi
      if (!conditions || conditions.length === 0) {
        throw new Error('Minimal satu kondisi harus diisi');
      }

         // 1. Cek apakah nama aset sudah ada
    const existingAsset = await client.query(
      'SELECT id FROM assets WHERE name = $1',
      [name]
    );

    if (existingAsset.rows.length > 0) {
      throw new Error(`Nama aset "${name}" sudah digunakan. Gunakan nama yang berbeda.`);
    }

      // 1. Insert asset
      const assetResult = await client.query(
        `INSERT INTO assets (name, category, location, description, acquisition_year, semester)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, category, location, description, 
                   acquisition_year as "acquisitionYear", semester`,
        [name, category, location, description || '', acquisitionYear || '', semester || '']
      );

      const assetId = assetResult.rows[0].id;

      // 2. Insert conditions
      for (const cond of conditions) {
        await client.query(
          `INSERT INTO asset_conditions (asset_id, condition, quantity)
           VALUES ($1, $2, $3)`,
          [assetId, cond.condition, cond.quantity]
        );
      }

      // 3. Get complete asset data
      const finalResult = await client.query(
        `SELECT 
          a.id, a.name, a.category, a.location, a.description,
          a.acquisition_year as "acquisitionYear", a.semester,
          a.total_stock as "totalStock", a.available_stock as "availableStock",
          a.created_at as "createdAt",
          COALESCE(
            json_agg(
              json_build_object(
                'condition', ac.condition,
                'quantity', ac.quantity
              )
            ) FILTER (WHERE ac.condition IS NOT NULL),
            '[]'
          ) as conditions
         FROM assets a
         LEFT JOIN asset_conditions ac ON a.id = ac.asset_id
         WHERE a.id = $1
         GROUP BY a.id`,
        [assetId]
      );

      await client.query('COMMIT');

      return h.response({
        status: 'success',
        message: 'Asset berhasil ditambahkan',
        data: {
          asset: finalResult.rows[0]
        }
      }).code(201);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create asset error:', error);

      if (error.message.includes('assets_name_unique')) {
      return h.response({
        status: 'error',
        message: error.message || 'Nama asset sudah digunakan. Gunakan nama lain.'
      }).code(400);
    }

      return h.response({
        status: 'error',
        message: error.message || 'Terjadi kesalahan server'
      }).code(500);
    } finally {
      client.release();
    }
  }

  static async updateAsset(request, h) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      const { id } = request.params;
      const {
        name,
        category,
        location,
        description,
        acquisitionYear,
        semester,
        conditions
      } = request.payload;

// cek nama aset udah dipakai atau belum
    const existingAsset = await client.query(
      'SELECT id FROM assets WHERE name = $1 AND id <> $2',
      [name, id]
    );

    if (existingAsset.rows.length > 0) {
      throw new Error(`Nama aset "${name}" sudah digunakan. Gunakan nama yang berbeda.`);
    }


      // 1. Update asset
      const result = await client.query(
        `UPDATE assets 
         SET name = $1, category = $2, location = $3, description = $4, 
             acquisition_year = $5, semester = $6, updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING id`,
        [name, category, location, description || '', acquisitionYear || '', semester || '', id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return h.response({
          status: 'error',
          message: 'Asset tidak ditemukan'
        }).code(404);
      }

      // 2. Delete old conditions
      await client.query('DELETE FROM asset_conditions WHERE asset_id = $1', [id]);

      // 3. Insert new conditions
      for (const cond of conditions) {
        await client.query(
          `INSERT INTO asset_conditions (asset_id, condition, quantity)
           VALUES ($1, $2, $3)`,
          [id, cond.condition, cond.quantity]
        );
      }

      // 4. Get updated asset data
      const finalResult = await client.query(
        `SELECT 
          a.id, a.name, a.category, a.location, a.description,
          a.acquisition_year as "acquisitionYear", a.semester,
          a.total_stock as "totalStock", a.available_stock as "availableStock",
          a.updated_at as "updatedAt",
          COALESCE(
            json_agg(
              json_build_object(
                'condition', ac.condition,
                'quantity', ac.quantity
              )
            ) FILTER (WHERE ac.condition IS NOT NULL),
            '[]'
          ) as conditions
         FROM assets a
         LEFT JOIN asset_conditions ac ON a.id = ac.asset_id
         WHERE a.id = $1
         GROUP BY a.id`,
        [id]
      );

      await client.query('COMMIT');

      return h.response({
        status: 'success',
        message: 'Asset berhasil diperbarui',
        data: {
          asset: finalResult.rows[0]
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Update asset error:', error);

if (error.message.includes('assets_name_unique')) {
      return h.response({
        status: 'error',
        message: error.message || 'Nama asset sudah digunakan. Gunakan nama lain.'
      }).code(400);
    }
      return h.response({
        status: 'error',
        message: error.message || 'Terjadi kesalahan server'
      }).code(500);
    } finally {
      client.release();
    }
  }

  static async deleteAsset(request, h) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      const { id } = request.params;

      // Cek apakah asset sedang dipinjam
      const checkLoan = await client.query(
        `SELECT EXISTS(
          SELECT 1 FROM loan_items li 
          JOIN loans l ON li.loan_id = l.id 
          WHERE li.asset_id = $1 AND l.status IN ('menunggu', 'disetujui')
        )`,
        [id]
      );

      if (checkLoan.rows[0].exists) {
        await client.query('ROLLBACK');
        return h.response({
          status: 'error',
          message: 'Tidak dapat menghapus asset yang sedang dipinjam'
        }).code(400);
      }

      const result = await client.query(
        'DELETE FROM assets WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return h.response({
          status: 'error',
          message: 'Asset tidak ditemukan'
        }).code(404);
      }

      await client.query('COMMIT');

      return h.response({
        status: 'success',
        message: 'Asset berhasil dihapus'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Delete asset error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    } finally {
      client.release();
    }
  }

  static async checkStockAvailability(request, h) {
    try {
      const { id } = request.params;
      const { quantity } = request.query;

      const result = await query(
        `SELECT 
          a.name,
          a.available_stock as "availableStock",
          (a.available_stock >= $2) as "isAvailable",
          CASE 
            WHEN a.available_stock >= $2 THEN 'Stok mencukupi'
            ELSE 'Stok tidak mencukupi. Tersedia: ' || a.available_stock
          END as "message"
         FROM assets a
         WHERE a.id = $1`,
        [id, parseInt(quantity)]
      );

      if (result.rows.length === 0) {
        return h.response({
          status: 'error',
          message: 'Asset tidak ditemukan'
        }).code(404);
      }

      return h.response({
        status: 'success',
        data: result.rows[0]
      });
      
    } catch (error) {
      console.error('Check stock error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }
}

module.exports = AssetController;
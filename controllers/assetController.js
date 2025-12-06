const { query } = require('../config/database');

class AssetController {
 static async getAssets(request, h) {
  try {
    const { search, category } = request.query;
    
    let sql = `
      SELECT 
        a.id, a.name, a.category, a.location, a.total_stock as "totalStock", 
        a.available_stock as "availableStock", a.description,
        a.acquisition_year as "acquisitionYear", a.created_at as "createdAt",
        json_agg(
          json_build_object(
            'condition', ac.condition,
            'quantity', ac.quantity
          )
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

    sql += ' GROUP BY a.id ORDER BY a.name';

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
        a.id, a.name, a.category, a.location, a.total_stock as "totalStock", 
        a.available_stock as "availableStock", a.description,
        a.acquisition_year as "acquisitionYear", a.created_at as "createdAt",
        json_agg(
          json_build_object(
            'condition', ac.condition,
            'quantity', ac.quantity
          )
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
      conditions, // Array: [{condition: 'baik', quantity: 150}, ...]
      description,
      acquisitionYear
    } = request.payload;

    // 1. Insert asset
    const assetResult = await client.query(
      `INSERT INTO assets (name, category, location, description, acquisition_year)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [name, category, location, description, acquisitionYear]
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
        a.acquisition_year as "acquisitionYear",
        a.total_stock as "totalStock",
        a.available_stock as "availableStock",
        a.created_at as "createdAt",
        json_agg(
          json_build_object(
            'condition', ac.condition,
            'quantity', ac.quantity
          )
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
      data: {
        asset: finalResult.rows[0]
      }
    }).code(201);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create asset error:', error);
    return h.response({
      status: 'error',
      message: 'Terjadi kesalahan server: ' + error.message
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
      conditions,
      description,
      acquisitionYear
    } = request.payload;

    // 1. Update asset
    const result = await client.query(
      `UPDATE assets 
       SET name = $1, category = $2, location = $3, description = $4, 
           acquisition_year = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id`,
      [name, category, location, description, acquisitionYear, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return h.response({
        status: 'error',
        message: 'Asset tidak ditemukan'
      }).code(404);
    }

    // 2. Hapus kondisi lama
    await client.query('DELETE FROM asset_conditions WHERE asset_id = $1', [id]);

    // 3. Insert kondisi baru
    for (const cond of conditions) {
      await client.query(
        `INSERT INTO asset_conditions (asset_id, condition, quantity)
         VALUES ($1, $2, $3)`,
        [id, cond.condition, cond.quantity]
      );
    }

    // 4. Ambil data terbaru
    const finalResult = await client.query(
      `SELECT 
        a.id, a.name, a.category, a.location, a.description,
        a.acquisition_year as "acquisitionYear",
        a.total_stock as "totalStock",
        a.available_stock as "availableStock",
        a.created_at as "createdAt",
        json_agg(
          json_build_object(
            'condition', ac.condition,
            'quantity', ac.quantity
          )
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
      data: {
        asset: finalResult.rows[0]
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update asset error:', error);
    return h.response({
      status: 'error',
      message: 'Terjadi kesalahan server: ' + error.message
    }).code(500);
  } finally {
    client.release();
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
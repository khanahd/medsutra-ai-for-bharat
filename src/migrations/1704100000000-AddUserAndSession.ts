import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class AddUserAndSession1704100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()'
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isUnique: true
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255'
          },
          {
            name: 'password_hash',
            type: 'varchar',
            length: '255'
          },
          {
            name: 'role',
            type: 'varchar',
            length: '50'
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true
          },
          {
            name: 'failed_login_attempts',
            type: 'int',
            default: 0
          },
          {
            name: 'locked_until',
            type: 'timestamp',
            isNullable: true
          },
          {
            name: 'last_login',
            type: 'timestamp',
            isNullable: true
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP'
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP'
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true
          }
        ]
      }),
      true
    );

    // Create sessions table
    await queryRunner.createTable(
      new Table({
        name: 'sessions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()'
          },
          {
            name: 'user_id',
            type: 'uuid'
          },
          {
            name: 'refresh_token',
            type: 'varchar',
            length: '500'
          },
          {
            name: 'ip_address',
            type: 'varchar',
            length: '100',
            isNullable: true
          },
          {
            name: 'user_agent',
            type: 'text',
            isNullable: true
          },
          {
            name: 'expires_at',
            type: 'timestamp'
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP'
          }
        ]
      }),
      true
    );

    // Add foreign key for sessions -> users
    await queryRunner.createForeignKey(
      'sessions',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE'
      })
    );

    // Create indexes
    await queryRunner.query(`CREATE INDEX idx_users_email ON users(email)`);
    await queryRunner.query(`CREATE INDEX idx_users_role ON users(role)`);
    await queryRunner.query(`CREATE INDEX idx_sessions_user_id ON sessions(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token)`);
    await queryRunner.query(`CREATE INDEX idx_sessions_expires_at ON sessions(expires_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    const table = await queryRunner.getTable('sessions');
    const foreignKey = table?.foreignKeys.find((fk) => fk.columnNames.indexOf('user_id') !== -1);
    if (foreignKey) {
      await queryRunner.dropForeignKey('sessions', foreignKey);
    }

    // Drop tables
    await queryRunner.dropTable('sessions');
    await queryRunner.dropTable('users');
  }
}

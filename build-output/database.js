import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
dotenv.config();
export class Database {
    constructor() {
        this.initialized = false;
        const normalizeEnv = (value) => {
            if (!value)
                return '';
            return value.trim().replace(/^['"]|['"]$/g, '').replace(/\$\{\{[^}]+\}\}/g, '');
        };
        const connectionUrl = normalizeEnv(process.env.DATABASE_URL || process.env.MYSQL_URL);
        const parsedUrl = connectionUrl ? (() => {
            try {
                return new URL(connectionUrl);
            }
            catch {
                return null;
            }
        })() : null;
        const host = normalizeEnv(process.env.DB_HOST || process.env.MYSQLHOST || parsedUrl?.hostname) || 'localhost';
        const port = Number(normalizeEnv(process.env.DB_PORT || process.env.MYSQLPORT || parsedUrl?.port) || 3306);
        const user = normalizeEnv(process.env.DB_USER || process.env.MYSQLUSER || parsedUrl?.username) || 'root';
        const password = normalizeEnv(process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || parsedUrl?.password) || 'password';
        const database = normalizeEnv(process.env.DB_NAME || process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || parsedUrl?.pathname.replace(/^\//, '')) || 'marketplace';
        const invalidMySqlValues = [
            'your_mysql_host',
            'your_mysql_root_password',
            'your_mysql_password',
            'your_mysql_user',
            'your_mysql_database',
            'your_mysql_name',
        ];
        const configChecks = [
            ['host', host],
            ['user', user],
            ['password', password],
            ['database', database],
        ];
        const invalidConfig = configChecks.filter(([, value]) => invalidMySqlValues.includes(value.toLowerCase()));
        if (invalidConfig.length) {
            const invalidKeys = invalidConfig.map(([key]) => key).join(', ');
            throw new Error(`Invalid MySQL configuration: placeholder values detected for ${invalidKeys}. ` +
                'Please set real MySQL credentials in your production environment variables.');
        }
        if (!host || !user || !password || !database) {
            throw new Error('Invalid MySQL configuration: missing required database connection settings. ' +
                'Ensure MYSQL_URL or MYSQLHOST / MYSQLUSER / MYSQLPASSWORD / MYSQLDATABASE are configured.');
        }
        this.pool = mysql.createPool({
            host,
            port,
            user,
            password,
            database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });
    }
    async ensureUserVerificationColumns() {
        const requiredColumns = [
            { name: 'verificationBadgeType', definition: 'VARCHAR(30) NULL DEFAULT NULL' },
            { name: 'verificationRequestStatus', definition: 'VARCHAR(20) NOT NULL DEFAULT "pending"' },
            { name: 'verificationFee', definition: 'DECIMAL(12,2) NOT NULL DEFAULT 0' },
            { name: 'emailVerified', definition: 'BOOLEAN NOT NULL DEFAULT FALSE' },
            { name: 'phoneVerified', definition: 'BOOLEAN NOT NULL DEFAULT FALSE' },
            { name: 'emailOtp', definition: 'VARCHAR(10) NULL' },
            { name: 'phoneOtp', definition: 'VARCHAR(10) NULL' },
            { name: 'otpExpiresAt', definition: 'TIMESTAMP NULL' },
        ];
        for (const column of requiredColumns) {
            const [rows] = await this.pool.query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', ['users', column.name]);
            if (!rows.length) {
                await this.pool.query(`ALTER TABLE users ADD COLUMN ${column.name} ${column.definition}`);
            }
        }
    }
    async ensureAvatarColumnType() {
        const [rows] = await this.pool.query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', ['users', 'avatar']);
        if (rows.length) {
            await this.pool.query('ALTER TABLE users MODIFY avatar MEDIUMTEXT NULL');
        }
    }
    async ensureUniqueIndex(tableName, indexName, columnName) {
        const [rows] = await this.pool.query('SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?', [tableName, indexName]);
        if (!rows.length) {
            await this.pool.query(`CREATE UNIQUE INDEX \`${indexName}\` ON \`${tableName}\` (\`${columnName}\`)`);
        }
    }
    async init() {
        if (this.initialized)
            return;
        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password TEXT NULL,
        role VARCHAR(20) NOT NULL,
        avatar MEDIUMTEXT NULL,
        walletBalance DECIMAL(12,2) NOT NULL DEFAULT 0,
        accountNumber VARCHAR(100) NULL,
        location JSON NULL,
        buyerPreferences JSON NULL,
        businessName VARCHAR(255) NULL,
        description TEXT NULL,
        phone VARCHAR(50) NULL,
        sellerLocation JSON NULL,
        paymentMethods JSON NULL,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        verificationLevel VARCHAR(20) NOT NULL DEFAULT 'unverified',
        verificationBadgeType VARCHAR(30) NULL DEFAULT NULL,
        verificationRequestStatus VARCHAR(20) NOT NULL DEFAULT 'pending',
        verificationFee DECIMAL(12,2) NOT NULL DEFAULT 0,
        emailVerified BOOLEAN NOT NULL DEFAULT FALSE,
        phoneVerified BOOLEAN NOT NULL DEFAULT FALSE,
        emailOtp VARCHAR(10) NULL,
        phoneOtp VARCHAR(10) NULL,
        otpExpiresAt TIMESTAMP NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
        await this.ensureUserVerificationColumns();
        await this.ensureAvatarColumnType();
        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS listings (
        id VARCHAR(36) PRIMARY KEY,
        sellerId VARCHAR(36) NOT NULL,
        sellerName VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        price DECIMAL(12,2) NOT NULL,
        category VARCHAR(100) NOT NULL,
        location JSON NOT NULL,
        images JSON NOT NULL,
        rating DECIMAL(3,1) NULL,
        reviewCount INT NULL,
        distance DECIMAL(10,2) NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id VARCHAR(36) PRIMARY KEY,
        reporterId VARCHAR(36) NOT NULL,
        reporterName VARCHAR(255) NOT NULL,
        reportedUserId VARCHAR(36) NOT NULL,
        reportedUserName VARCHAR(255) NOT NULL,
        reportedRole VARCHAR(20) NOT NULL,
        type VARCHAR(20) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        details TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS account_deletion_requests (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        userName VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NULL DEFAULT NULL,
        reviewedAt TIMESTAMP NULL DEFAULT NULL,
        reviewedBy VARCHAR(255) NULL
      )
    `);
        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(36) PRIMARY KEY,
        listingId VARCHAR(36) NOT NULL,
        listingTitle VARCHAR(255) NOT NULL,
        buyerId VARCHAR(36) NOT NULL,
        buyerName VARCHAR(255) NOT NULL,
        sellerId VARCHAR(36) NOT NULL,
        sellerName VARCHAR(255) NOT NULL,
        price DECIMAL(12,2) NOT NULL,
        status VARCHAR(50) NOT NULL,
        paymentStatus VARCHAR(50) NOT NULL,
        paymentLockedAt TIMESTAMP NULL,
        deliveryDetails JSON NULL,
        confirmationDeadline TIMESTAMP NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        notes TEXT NULL,
        transactionIds JSON NULL
      )
    `);
        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(36) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        userId VARCHAR(36) NOT NULL,
        counterpartyId VARCHAR(36) NULL,
        orderId VARCHAR(36) NULL,
        amount DECIMAL(12,2) NOT NULL,
        status VARCHAR(50) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        paymentMethod JSON NULL,
        paymentGateway VARCHAR(50) NULL,
        reference VARCHAR(255) NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completedAt TIMESTAMP NULL,
        details TEXT NULL,
        metadata JSON NULL
      )
    `);
        await this.ensureUniqueIndex('transactions', 'idx_transactions_reference', 'reference');
        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL UNIQUE,
        balance DECIMAL(12,2) NOT NULL DEFAULT 0,
        currency VARCHAR(3) NOT NULL,
        transactions JSON NULL,
        lastUpdated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
        this.initialized = true;
    }
    async close() {
        await this.pool.end();
    }
    async select(sql, params = []) {
        await this.init();
        const [rows] = await this.pool.execute(sql, params);
        return rows;
    }
    async execute(sql, params = []) {
        await this.init();
        const [result] = await this.pool.execute(sql, params);
        return result;
    }
    parseJson(value) {
        if (value === null || value === undefined)
            return undefined;
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            }
            catch {
                return value;
            }
        }
        return value;
    }
    stringifyJson(value) {
        if (value === undefined || value === null)
            return null;
        return JSON.stringify(value);
    }
    toSqlDateTime(value) {
        if (!value)
            return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime()))
            return null;
        return date.toISOString().slice(0, 19).replace('T', ' ');
    }
    fromSqlDateTime(value) {
        if (!value)
            return undefined;
        if (typeof value === 'string' && value.includes('T'))
            return value;
        const date = new Date(value);
        if (Number.isNaN(date.getTime()))
            return value;
        return date.toISOString();
    }
    toUser(row) {
        return {
            id: row.id,
            name: row.name,
            email: row.email,
            password: row.password || undefined,
            role: row.role,
            avatar: row.avatar || undefined,
            walletBalance: Number(row.walletBalance || 0),
            accountNumber: row.accountNumber,
            location: this.parseJson(row.location),
            buyerPreferences: this.parseJson(row.buyerPreferences),
            businessName: row.businessName || undefined,
            description: row.description || undefined,
            phone: row.phone || undefined,
            sellerLocation: this.parseJson(row.sellerLocation),
            paymentMethods: this.parseJson(row.paymentMethods),
            verified: Boolean(row.verified),
            verificationLevel: row.verificationLevel,
            verificationBadgeType: row.verificationBadgeType || undefined,
            verificationRequestStatus: row.verificationRequestStatus || 'pending',
            verificationFee: row.verificationFee !== null && row.verificationFee !== undefined ? Number(row.verificationFee) : 0,
            emailVerified: Boolean(row.emailVerified),
            phoneVerified: Boolean(row.phoneVerified),
            emailOtp: row.emailOtp || undefined,
            phoneOtp: row.phoneOtp || undefined,
            otpExpiresAt: this.fromSqlDateTime(row.otpExpiresAt) || undefined,
            createdAt: this.fromSqlDateTime(row.createdAt) || row.createdAt,
            updatedAt: this.fromSqlDateTime(row.updatedAt) || row.updatedAt,
        };
    }
    toListing(row) {
        return {
            id: row.id,
            sellerId: row.sellerId,
            sellerName: row.sellerName,
            title: row.title,
            description: row.description,
            price: Number(row.price || 0),
            category: row.category,
            location: this.parseJson(row.location) || { city: '', state: '', country: '' },
            images: this.parseJson(row.images) || [],
            rating: row.rating !== null ? Number(row.rating) : undefined,
            reviewCount: row.reviewCount !== null ? Number(row.reviewCount) : undefined,
            distance: row.distance !== null ? Number(row.distance) : undefined,
            createdAt: this.fromSqlDateTime(row.createdAt) || row.createdAt,
            updatedAt: this.fromSqlDateTime(row.updatedAt) || row.updatedAt,
        };
    }
    toOrder(row) {
        return {
            id: row.id,
            listingId: row.listingId,
            listingTitle: row.listingTitle,
            buyerId: row.buyerId,
            buyerName: row.buyerName,
            sellerId: row.sellerId,
            sellerName: row.sellerName,
            price: Number(row.price || 0),
            status: row.status,
            paymentStatus: row.paymentStatus,
            paymentLockedAt: this.fromSqlDateTime(row.paymentLockedAt) || undefined,
            deliveryDetails: this.parseJson(row.deliveryDetails),
            confirmationDeadline: this.fromSqlDateTime(row.confirmationDeadline) || undefined,
            createdAt: this.fromSqlDateTime(row.createdAt) || row.createdAt,
            updatedAt: this.fromSqlDateTime(row.updatedAt) || row.updatedAt,
            notes: row.notes || undefined,
            transactionIds: this.parseJson(row.transactionIds) || [],
        };
    }
    toTransaction(row) {
        return {
            id: row.id,
            type: row.type,
            userId: row.userId,
            counterpartyId: row.counterpartyId || undefined,
            orderId: row.orderId || undefined,
            amount: Number(row.amount || 0),
            status: row.status,
            currency: row.currency,
            paymentMethod: this.parseJson(row.paymentMethod),
            paymentGateway: row.paymentGateway || undefined,
            reference: row.reference || undefined,
            createdAt: this.fromSqlDateTime(row.createdAt) || row.createdAt,
            completedAt: this.fromSqlDateTime(row.completedAt) || undefined,
            details: row.details || undefined,
            metadata: this.parseJson(row.metadata),
        };
    }
    toWallet(row) {
        return {
            id: row.id,
            userId: row.userId,
            balance: Number(row.balance || 0),
            currency: row.currency,
            transactions: this.parseJson(row.transactions) || [],
            lastUpdated: this.fromSqlDateTime(row.lastUpdated) || row.lastUpdated,
        };
    }
    toReport(row) {
        return {
            id: row.id,
            reporterId: row.reporterId,
            reporterName: row.reporterName,
            reportedUserId: row.reportedUserId,
            reportedUserName: row.reportedUserName,
            reportedRole: row.reportedRole,
            type: row.type,
            subject: row.subject,
            details: row.details,
            status: row.status,
            createdAt: this.fromSqlDateTime(row.createdAt) || row.createdAt,
            updatedAt: this.fromSqlDateTime(row.updatedAt) || row.updatedAt,
        };
    }
    toAccountDeletionRequest(row) {
        return {
            id: row.id,
            userId: row.userId,
            userName: row.userName,
            email: row.email,
            reason: row.reason,
            status: row.status,
            createdAt: this.fromSqlDateTime(row.createdAt) || row.createdAt,
            updatedAt: this.fromSqlDateTime(row.updatedAt) || undefined,
            reviewedAt: this.fromSqlDateTime(row.reviewedAt) || undefined,
            reviewedBy: row.reviewedBy || undefined,
        };
    }
    async addUser(user) {
        await this.execute(`INSERT INTO users (id, name, email, password, role, avatar, walletBalance, accountNumber, location, buyerPreferences, businessName, description, phone, sellerLocation, paymentMethods, verified, verificationLevel, verificationBadgeType, verificationRequestStatus, verificationFee, emailVerified, phoneVerified, emailOtp, phoneOtp, otpExpiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )`, [
            user.id,
            user.name,
            user.email,
            user.password || null,
            user.role,
            user.avatar || null,
            user.walletBalance,
            user.accountNumber,
            this.stringifyJson(user.location),
            this.stringifyJson(user.buyerPreferences),
            user.businessName || null,
            user.description || null,
            user.phone || null,
            this.stringifyJson(user.sellerLocation),
            this.stringifyJson(user.paymentMethods),
            user.verified ? 1 : 0,
            user.verificationLevel,
            user.verificationBadgeType || null,
            user.verificationRequestStatus || 'pending',
            user.verificationFee ?? 0,
            user.emailVerified ? 1 : 0,
            user.phoneVerified ? 1 : 0,
            user.emailOtp || null,
            user.phoneOtp || null,
            this.toSqlDateTime(user.otpExpiresAt),
            this.toSqlDateTime(user.createdAt),
            this.toSqlDateTime(user.updatedAt),
        ]);
        return user;
    }
    async getUser(id) {
        const rows = await this.select('SELECT * FROM users WHERE id = ?', [id]);
        return rows[0] ? this.toUser(rows[0]) : undefined;
    }
    async getUserByEmail(email) {
        const rows = await this.select('SELECT * FROM users WHERE email = ?', [email]);
        return rows[0] ? this.toUser(rows[0]) : undefined;
    }
    async updateUser(id, updates) {
        const existing = await this.getUser(id);
        if (!existing)
            return undefined;
        const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
        await this.execute(`UPDATE users SET name = ?, email = ?, password = ?, role = ?, avatar = ?, walletBalance = ?, accountNumber = ?, location = ?, buyerPreferences = ?, businessName = ?, description = ?, phone = ?, sellerLocation = ?, paymentMethods = ?, verified = ?, verificationLevel = ?, verificationBadgeType = ?, verificationRequestStatus = ?, verificationFee = ?, emailVerified = ?, phoneVerified = ?, emailOtp = ?, phoneOtp = ?, otpExpiresAt = ?, updatedAt = ? WHERE id = ?`, [
            merged.name,
            merged.email,
            merged.password || null,
            merged.role,
            merged.avatar || null,
            merged.walletBalance,
            merged.accountNumber,
            this.stringifyJson(merged.location),
            this.stringifyJson(merged.buyerPreferences),
            merged.businessName || null,
            merged.description || null,
            merged.phone || null,
            this.stringifyJson(merged.sellerLocation),
            this.stringifyJson(merged.paymentMethods),
            merged.verified ? 1 : 0,
            merged.verificationLevel,
            merged.verificationBadgeType || null,
            merged.verificationRequestStatus || 'pending',
            merged.verificationFee ?? 0,
            merged.emailVerified ? 1 : 0,
            merged.phoneVerified ? 1 : 0,
            merged.emailOtp || null,
            merged.phoneOtp || null,
            this.toSqlDateTime(merged.otpExpiresAt),
            this.toSqlDateTime(merged.updatedAt),
            id,
        ]);
        return merged;
    }
    async getAllUsers() {
        const rows = await this.select('SELECT * FROM users ORDER BY createdAt DESC');
        return rows.map((row) => this.toUser(row));
    }
    async addReport(report) {
        await this.execute(`INSERT INTO reports (id, reporterId, reporterName, reportedUserId, reportedUserName, reportedRole, type, subject, details, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )`, [
            report.id,
            report.reporterId,
            report.reporterName,
            report.reportedUserId,
            report.reportedUserName,
            report.reportedRole,
            report.type,
            report.subject,
            report.details,
            report.status,
            this.toSqlDateTime(report.createdAt),
            this.toSqlDateTime(report.updatedAt),
        ]);
        return report;
    }
    async getReport(id) {
        const rows = await this.select('SELECT * FROM reports WHERE id = ?', [id]);
        return rows[0] ? this.toReport(rows[0]) : undefined;
    }
    async getAllReports() {
        const rows = await this.select('SELECT * FROM reports ORDER BY createdAt DESC');
        return rows.map((row) => this.toReport(row));
    }
    async addAccountDeletionRequest(request) {
        await this.execute(`INSERT INTO account_deletion_requests (id, userId, userName, email, reason, status, createdAt, updatedAt, reviewedAt, reviewedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            request.id,
            request.userId,
            request.userName,
            request.email,
            request.reason,
            request.status,
            this.toSqlDateTime(request.createdAt),
            this.toSqlDateTime(request.updatedAt),
            this.toSqlDateTime(request.reviewedAt),
            request.reviewedBy || null,
        ]);
        return request;
    }
    async getAllAccountDeletionRequests() {
        const rows = await this.select('SELECT * FROM account_deletion_requests ORDER BY createdAt DESC');
        return rows.map((row) => this.toAccountDeletionRequest(row));
    }
    async updateAccountDeletionRequest(id, updates) {
        const existing = await this.getAccountDeletionRequest(id);
        if (!existing)
            return undefined;
        const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
        await this.execute(`UPDATE account_deletion_requests SET userId = ?, userName = ?, email = ?, reason = ?, status = ?, updatedAt = ?, reviewedAt = ?, reviewedBy = ? WHERE id = ?`, [
            merged.userId,
            merged.userName,
            merged.email,
            merged.reason,
            merged.status,
            this.toSqlDateTime(merged.updatedAt),
            this.toSqlDateTime(merged.reviewedAt),
            merged.reviewedBy || null,
            id,
        ]);
        return merged;
    }
    async getAccountDeletionRequest(id) {
        const rows = await this.select('SELECT * FROM account_deletion_requests WHERE id = ?', [id]);
        return rows[0] ? this.toAccountDeletionRequest(rows[0]) : undefined;
    }
    async updateReport(id, updates) {
        const existing = await this.getReport(id);
        if (!existing)
            return undefined;
        const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
        await this.execute(`UPDATE reports SET reporterId = ?, reporterName = ?, reportedUserId = ?, reportedUserName = ?, reportedRole = ?, type = ?, subject = ?, details = ?, status = ?, updatedAt = ? WHERE id = ?`, [
            merged.reporterId,
            merged.reporterName,
            merged.reportedUserId,
            merged.reportedUserName,
            merged.reportedRole,
            merged.type,
            merged.subject,
            merged.details,
            merged.status,
            this.toSqlDateTime(merged.updatedAt),
            id,
        ]);
        return merged;
    }
    async addListing(listing) {
        await this.execute(`INSERT INTO listings (id, sellerId, sellerName, title, description, price, category, location, images, rating, reviewCount, distance, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            listing.id,
            listing.sellerId,
            listing.sellerName,
            listing.title,
            listing.description,
            listing.price,
            listing.category,
            this.stringifyJson(listing.location),
            this.stringifyJson(listing.images),
            listing.rating ?? null,
            listing.reviewCount ?? null,
            listing.distance ?? null,
            this.toSqlDateTime(listing.createdAt),
            this.toSqlDateTime(listing.updatedAt),
        ]);
        return listing;
    }
    async getListing(id) {
        const rows = await this.select('SELECT * FROM listings WHERE id = ?', [id]);
        return rows[0] ? this.toListing(rows[0]) : undefined;
    }
    async getListingsBySeller(sellerId) {
        const rows = await this.select('SELECT * FROM listings WHERE sellerId = ? ORDER BY createdAt DESC', [sellerId]);
        return rows.map((row) => this.toListing(row));
    }
    async getAllListings() {
        const rows = await this.select('SELECT * FROM listings ORDER BY createdAt DESC');
        return rows.map((row) => this.toListing(row));
    }
    async updateListing(id, updates) {
        const existing = await this.getListing(id);
        if (!existing)
            return undefined;
        const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
        await this.execute(`UPDATE listings SET sellerId = ?, sellerName = ?, title = ?, description = ?, price = ?, category = ?, location = ?, images = ?, rating = ?, reviewCount = ?, distance = ?, updatedAt = ? WHERE id = ?`, [
            merged.sellerId,
            merged.sellerName,
            merged.title,
            merged.description,
            merged.price,
            merged.category,
            this.stringifyJson(merged.location),
            this.stringifyJson(merged.images),
            merged.rating ?? null,
            merged.reviewCount ?? null,
            merged.distance ?? null,
            this.toSqlDateTime(merged.updatedAt),
            id,
        ]);
        return merged;
    }
    async deleteUser(id) {
        const user = await this.getUser(id);
        if (!user)
            return false;
        const deletedEmail = `deleted.${id}@deleted.local`;
        const result = await this.execute(`UPDATE users SET
        name = ?,
        email = ?,
        password = NULL,
        avatar = NULL,
        accountNumber = NULL,
        phone = NULL,
        businessName = NULL,
        description = NULL,
        sellerLocation = NULL,
        paymentMethods = NULL,
        verified = FALSE,
        verificationLevel = 'unverified',
        verificationBadgeType = NULL,
        verificationRequestStatus = 'pending',
        verificationFee = 0,
        emailVerified = FALSE,
        phoneVerified = FALSE,
        emailOtp = NULL,
        phoneOtp = NULL,
        otpExpiresAt = NULL,
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?`, [
            `Deleted User ${id.slice(0, 8)}`,
            deletedEmail,
            id,
        ]);
        return result.affectedRows > 0;
    }
    async deleteListing(id) {
        const result = await this.execute('DELETE FROM listings WHERE id = ?', [id]);
        const affectedRows = result?.affectedRows ?? result?.[0]?.affectedRows ?? 0;
        return Number(affectedRows) > 0;
    }
    async addOrder(order) {
        await this.execute(`INSERT INTO orders (id, listingId, listingTitle, buyerId, buyerName, sellerId, sellerName, price, status, paymentStatus, paymentLockedAt, deliveryDetails, confirmationDeadline, createdAt, updatedAt, notes, transactionIds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            order.id,
            order.listingId,
            order.listingTitle,
            order.buyerId,
            order.buyerName,
            order.sellerId,
            order.sellerName,
            order.price,
            order.status,
            order.paymentStatus,
            this.toSqlDateTime(order.paymentLockedAt),
            this.stringifyJson(order.deliveryDetails),
            this.toSqlDateTime(order.confirmationDeadline),
            this.toSqlDateTime(order.createdAt),
            this.toSqlDateTime(order.updatedAt),
            order.notes || null,
            this.stringifyJson(order.transactionIds),
        ]);
        return order;
    }
    async getOrder(id) {
        const rows = await this.select('SELECT * FROM orders WHERE id = ?', [id]);
        return rows[0] ? this.toOrder(rows[0]) : undefined;
    }
    async getOrdersByBuyer(buyerId) {
        const rows = await this.select('SELECT * FROM orders WHERE buyerId = ? ORDER BY createdAt DESC', [buyerId]);
        return rows.map((row) => this.toOrder(row));
    }
    async getOrdersBySeller(sellerId) {
        const rows = await this.select('SELECT * FROM orders WHERE sellerId = ? ORDER BY createdAt DESC', [sellerId]);
        return rows.map((row) => this.toOrder(row));
    }
    async getAllOrders() {
        const rows = await this.select('SELECT * FROM orders ORDER BY createdAt DESC');
        return rows.map((row) => this.toOrder(row));
    }
    async updateOrder(id, updates) {
        const existing = await this.getOrder(id);
        if (!existing)
            return undefined;
        const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
        await this.execute(`UPDATE orders SET listingId = ?, listingTitle = ?, buyerId = ?, buyerName = ?, sellerId = ?, sellerName = ?, price = ?, status = ?, paymentStatus = ?, paymentLockedAt = ?, deliveryDetails = ?, confirmationDeadline = ?, notes = ?, transactionIds = ?, updatedAt = ? WHERE id = ?`, [
            merged.listingId,
            merged.listingTitle,
            merged.buyerId,
            merged.buyerName,
            merged.sellerId,
            merged.sellerName,
            merged.price,
            merged.status,
            merged.paymentStatus,
            this.toSqlDateTime(merged.paymentLockedAt),
            this.stringifyJson(merged.deliveryDetails),
            this.toSqlDateTime(merged.confirmationDeadline),
            merged.notes || null,
            this.stringifyJson(merged.transactionIds),
            this.toSqlDateTime(merged.updatedAt),
            id,
        ]);
        return merged;
    }
    async addTransaction(transaction) {
        await this.execute(`INSERT INTO transactions (id, type, userId, counterpartyId, orderId, amount, status, currency, paymentMethod, paymentGateway, reference, createdAt, completedAt, details, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            transaction.id,
            transaction.type,
            transaction.userId,
            transaction.counterpartyId || null,
            transaction.orderId || null,
            transaction.amount,
            transaction.status,
            transaction.currency,
            this.stringifyJson(transaction.paymentMethod),
            transaction.paymentGateway || null,
            transaction.reference || null,
            this.toSqlDateTime(transaction.createdAt),
            this.toSqlDateTime(transaction.completedAt),
            transaction.details || null,
            this.stringifyJson(transaction.metadata),
        ]);
        return transaction;
    }
    async getTransaction(id) {
        const rows = await this.select('SELECT * FROM transactions WHERE id = ?', [id]);
        return rows[0] ? this.toTransaction(rows[0]) : undefined;
    }
    async getTransactionsByUser(userId) {
        const rows = await this.select('SELECT * FROM transactions WHERE userId = ? OR counterpartyId = ? ORDER BY createdAt DESC', [userId, userId]);
        return rows.map((row) => this.toTransaction(row));
    }
    async getTransactionsByReference(reference) {
        const rows = await this.select('SELECT * FROM transactions WHERE reference = ? LIMIT 1', [reference]);
        return rows[0] ? this.toTransaction(rows[0]) : undefined;
    }
    async getAllTransactions() {
        const rows = await this.select('SELECT * FROM transactions ORDER BY createdAt DESC');
        return rows.map((row) => this.toTransaction(row));
    }
    async updateTransaction(id, updates) {
        const existing = await this.getTransaction(id);
        if (!existing)
            return undefined;
        const merged = { ...existing, ...updates };
        await this.execute(`UPDATE transactions SET type = ?, userId = ?, counterpartyId = ?, orderId = ?, amount = ?, status = ?, currency = ?, paymentMethod = ?, paymentGateway = ?, reference = ?, completedAt = ?, details = ?, metadata = ? WHERE id = ?`, [
            merged.type,
            merged.userId,
            merged.counterpartyId || null,
            merged.orderId || null,
            merged.amount,
            merged.status,
            merged.currency,
            this.stringifyJson(merged.paymentMethod),
            merged.paymentGateway || null,
            merged.reference || null,
            this.toSqlDateTime(merged.completedAt),
            merged.details || null,
            this.stringifyJson(merged.metadata),
            id,
        ]);
        return merged;
    }
    async addWallet(wallet) {
        await this.execute(`INSERT INTO wallets (id, userId, balance, currency, transactions, lastUpdated) VALUES (?, ?, ?, ?, ?, ?)`, [wallet.id, wallet.userId, wallet.balance, wallet.currency, this.stringifyJson(wallet.transactions), this.toSqlDateTime(wallet.lastUpdated)]);
        return wallet;
    }
    async getWallet(userId) {
        const rows = await this.select('SELECT * FROM wallets WHERE userId = ?', [userId]);
        return rows[0] ? this.toWallet(rows[0]) : undefined;
    }
    async updateWallet(userId, updates) {
        const existing = await this.getWallet(userId);
        if (!existing)
            return undefined;
        const merged = { ...existing, ...updates, lastUpdated: new Date().toISOString() };
        await this.execute(`UPDATE wallets SET balance = ?, currency = ?, transactions = ?, lastUpdated = ? WHERE userId = ?`, [merged.balance, merged.currency, this.stringifyJson(merged.transactions), this.toSqlDateTime(merged.lastUpdated), userId]);
        return merged;
    }
}
export const db = new Database();
export async function initializeDatabase() {
    await db.init();
}
//# sourceMappingURL=database.js.map
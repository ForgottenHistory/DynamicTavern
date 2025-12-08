import bcrypt from 'bcryptjs';
import { db } from './db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

export async function createUser(username: string, displayName: string, password: string) {
	const passwordHash = await hashPassword(password);

	const result = await db
		.insert(users)
		.values({
			username,
			displayName,
			passwordHash
		})
		.returning();

	return result[0];
}

export async function findUserByUsername(username: string) {
	const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
	return result[0] || null;
}

export async function authenticateUser(username: string, password: string) {
	const user = await findUserByUsername(username);

	if (!user) {
		return null;
	}

	const isValid = await verifyPassword(password, user.passwordHash);

	if (!isValid) {
		return null;
	}

	// Return user without password hash
	const { passwordHash, ...userWithoutPassword } = user;
	return userWithoutPassword;
}

export async function getUserById(userId: number) {
	const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);

	if (!result[0]) {
		return null;
	}

	const { passwordHash, ...userWithoutPassword } = result[0];
	return userWithoutPassword;
}

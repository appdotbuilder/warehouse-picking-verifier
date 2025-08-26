import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test input data
const testInput: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'Admin'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user', async () => {
    const result = await createUser(testInput);

    // Basic field validation
    expect(result.username).toEqual('testuser');
    expect(result.email).toEqual('test@example.com');
    expect(result.full_name).toEqual('Test User');
    expect(result.role).toEqual('Admin');
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Query the database to verify the user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].username).toEqual('testuser');
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].full_name).toEqual('Test User');
    expect(users[0].role).toEqual('Admin');
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create users with different roles', async () => {
    const adminInput: CreateUserInput = {
      username: 'admin_user',
      email: 'admin@example.com',
      full_name: 'Admin User',
      role: 'Admin'
    };

    const pickerInput: CreateUserInput = {
      username: 'picker_user',
      email: 'picker@example.com',
      full_name: 'Picker User',
      role: 'Picking'
    };

    const requesterInput: CreateUserInput = {
      username: 'requester_user',
      email: 'requester@example.com',
      full_name: 'Requester User',
      role: 'Requester'
    };

    const adminUser = await createUser(adminInput);
    const pickerUser = await createUser(pickerInput);
    const requesterUser = await createUser(requesterInput);

    expect(adminUser.role).toEqual('Admin');
    expect(pickerUser.role).toEqual('Picking');
    expect(requesterUser.role).toEqual('Requester');
  });

  it('should enforce unique username constraint', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create another user with the same username
    const duplicateUsernameInput: CreateUserInput = {
      username: 'testuser', // Same username
      email: 'different@example.com',
      full_name: 'Different User',
      role: 'Picking'
    };

    await expect(createUser(duplicateUsernameInput)).rejects.toThrow(/unique/i);
  });

  it('should enforce unique email constraint', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create another user with the same email
    const duplicateEmailInput: CreateUserInput = {
      username: 'different_user',
      email: 'test@example.com', // Same email
      full_name: 'Different User',
      role: 'Requester'
    };

    await expect(createUser(duplicateEmailInput)).rejects.toThrow(/unique/i);
  });

  it('should set timestamps correctly', async () => {
    const beforeCreation = new Date();
    const result = await createUser(testInput);
    const afterCreation = new Date();

    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.created_at >= beforeCreation).toBe(true);
    expect(result.created_at <= afterCreation).toBe(true);
    expect(result.updated_at >= beforeCreation).toBe(true);
    expect(result.updated_at <= afterCreation).toBe(true);
  });

  it('should handle multiple users creation', async () => {
    const user1Input: CreateUserInput = {
      username: 'user1',
      email: 'user1@example.com',
      full_name: 'User One',
      role: 'Admin'
    };

    const user2Input: CreateUserInput = {
      username: 'user2',
      email: 'user2@example.com',
      full_name: 'User Two',
      role: 'Picking'
    };

    const user1 = await createUser(user1Input);
    const user2 = await createUser(user2Input);

    // Verify both users were created with different IDs
    expect(user1.id).not.toEqual(user2.id);
    expect(user1.username).toEqual('user1');
    expect(user2.username).toEqual('user2');

    // Verify both users exist in database
    const allUsers = await db.select()
      .from(usersTable)
      .execute();

    expect(allUsers).toHaveLength(2);
  });
});
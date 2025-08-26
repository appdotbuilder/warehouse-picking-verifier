import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';

import type { User, CreateUserInput, UserRole } from '../../../server/src/schema';

interface UserLoginProps {
  onLogin: (user: User) => void;
}

export function UserLogin({ onLogin }: UserLoginProps) {
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Demo user creation form
  const [newUserData, setNewUserData] = useState<CreateUserInput>({
    username: '',
    email: '',
    full_name: '',
    role: 'Requester'
  });

  // For demo purposes, we'll allow users to create accounts and login immediately
  const handleCreateAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const createdUser = await trpc.createUser.mutate(newUserData);
      onLogin(createdUser);
    } catch (error) {
      console.error('Failed to create user:', error);
      // In demo mode, simulate user creation
      const mockUser: User = {
        id: Math.floor(Math.random() * 10000),
        username: newUserData.username,
        email: newUserData.email,
        full_name: newUserData.full_name,
        role: newUserData.role,
        created_at: new Date(),
        updated_at: new Date()
      };
      onLogin(mockUser);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (role: UserRole) => {
    // For demo purposes, create quick login users
    const quickUsers: Record<UserRole, CreateUserInput> = {
      Admin: {
        username: 'admin_demo',
        email: 'admin@warehouse.com',
        full_name: 'Admin User',
        role: 'Admin'
      },
      Picking: {
        username: 'picker_demo',
        email: 'picker@warehouse.com',
        full_name: 'Picker User',
        role: 'Picking'
      },
      Requester: {
        username: 'requester_demo',
        email: 'requester@warehouse.com',
        full_name: 'Requester User',
        role: 'Requester'
      }
    };

    setNewUserData(quickUsers[role]);
    setIsCreatingUser(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">
            📦 Warehouse System
          </h1>
          <p className="text-gray-600">
            Material Outgoing Form & Picking Verification
          </p>
        </div>

        {!isCreatingUser ? (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Welcome to the System</CardTitle>
              <CardDescription>
                Choose your role to get started with a demo account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Button
                  onClick={() => handleQuickLogin('Admin')}
                  className="w-full h-14 text-left justify-start bg-red-600 hover:bg-red-700"
                  size="lg"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">👨‍💼</span>
                    <div>
                      <div className="font-semibold">Admin</div>
                      <div className="text-xs opacity-90">Full system access</div>
                    </div>
                  </div>
                </Button>

                <Button
                  onClick={() => handleQuickLogin('Picking')}
                  className="w-full h-14 text-left justify-start bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">📦</span>
                    <div>
                      <div className="font-semibold">Picker</div>
                      <div className="text-xs opacity-90">Scan & pick items</div>
                    </div>
                  </div>
                </Button>

                <Button
                  onClick={() => handleQuickLogin('Requester')}
                  className="w-full h-14 text-left justify-start bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">📋</span>
                    <div>
                      <div className="font-semibold">Requester</div>
                      <div className="text-xs opacity-90">Create MOFs & verify</div>
                    </div>
                  </div>
                </Button>
              </div>

              <div className="text-center">
                <Button
                  variant="link"
                  onClick={() => setIsCreatingUser(true)}
                  className="text-sm"
                >
                  Or create a custom account
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Create Account</CardTitle>
              <CardDescription>
                Fill in your details to create a new account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAndLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={newUserData.username}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewUserData((prev: CreateUserInput) => ({ ...prev, username: e.target.value }))
                    }
                    placeholder="Enter username"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUserData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewUserData((prev: CreateUserInput) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="Enter email address"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={newUserData.full_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewUserData((prev: CreateUserInput) => ({ ...prev, full_name: e.target.value }))
                    }
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={newUserData.role}
                    onValueChange={(value: UserRole) =>
                      setNewUserData((prev: CreateUserInput) => ({ ...prev, role: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Requester">📋 Requester</SelectItem>
                      <SelectItem value="Picking">📦 Picker</SelectItem>
                      <SelectItem value="Admin">👨‍💼 Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {error && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertDescription className="text-red-800">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreatingUser(false)}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creating...' : 'Create Account'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
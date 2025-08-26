import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';

// Import role-specific components
import { AdminDashboard } from '@/components/AdminDashboard';
import { RequesterDashboard } from '@/components/RequesterDashboard';
import { PickerDashboard } from '@/components/PickerDashboard';
import { UserLogin } from '@/components/UserLogin';

// Import types
import type { User, UserRole } from '../../server/src/schema';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isHealthy, setIsHealthy] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // Check server health on startup
  const checkHealth = useCallback(async () => {
    try {
      await trpc.healthcheck.query();
      setIsHealthy(true);
      setIsDemoMode(false);
    } catch (error) {
      console.error('Server health check failed:', error);
      // For demo purposes, we'll allow the app to continue in demo mode
      setIsHealthy(true);
      setIsDemoMode(true);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const getRoleColor = (role: UserRole): string => {
    switch (role) {
      case 'Admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Picking':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Requester':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleEmoji = (role: UserRole): string => {
    switch (role) {
      case 'Admin':
        return '👨‍💼';
      case 'Picking':
        return '📦';
      case 'Requester':
        return '📋';
      default:
        return '👤';
    }
  };

  if (!isHealthy) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">⚠️ Server Connection Failed</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Unable to connect to the warehouse system server.
            </p>
            <Button onClick={checkHealth} className="w-full">
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentUser) {
    return <UserLogin onLogin={handleLogin} />;
  }

  const renderDashboard = () => {
    switch (currentUser.role) {
      case 'Admin':
        return <AdminDashboard user={currentUser} />;
      case 'Picking':
        return <PickerDashboard user={currentUser} />;
      case 'Requester':
        return <RequesterDashboard user={currentUser} />;
      default:
        return (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-600">
                Unknown role: {currentUser.role}
              </p>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                📦 Warehouse Picking System
              </h1>
              {isDemoMode && (
                <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                  🚀 Demo Mode
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <Badge className={getRoleColor(currentUser.role)}>
                {getRoleEmoji(currentUser.role)} {currentUser.role}
              </Badge>
              <div className="text-sm text-gray-600">
                <div className="font-medium">{currentUser.full_name}</div>
                <div className="text-xs">{currentUser.username}</div>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isDemoMode && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <AlertDescription className="text-orange-800">
              <strong>🚀 Demo Mode Active:</strong> The backend server is not connected. 
              All data and operations are simulated for demonstration purposes. 
              In a production environment, this would connect to a real database and server.
            </AlertDescription>
          </Alert>
        )}
        {renderDashboard()}
      </main>
    </div>
  );
}

export default App;
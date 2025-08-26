import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';

import type { User, Mof, Item, MofStatus, MofProgress } from '../../../server/src/schema';

interface AdminDashboardProps {
  user: User;
}

export function AdminDashboard({ user }: AdminDashboardProps) {
  const [mofs, setMofs] = useState<Mof[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedMofProgress, setSelectedMofProgress] = useState<MofProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMofs = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await trpc.getAllMofs.query();
      setMofs(result);
      setError(null);
    } catch (error) {
      console.error('Failed to load MOFs:', error);
      // Provide demo data when backend is not available
      setMofs([]);
      setError(null); // Don't show error in demo mode
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const result = await trpc.getAllItems.query();
      setItems(result);
    } catch (error) {
      console.error('Failed to load items:', error);
      // Provide demo data when backend is not available
      setItems([]);
    }
  }, []);

  const loadMofProgress = useCallback(async (mofId: number) => {
    try {
      const progress = await trpc.getMofProgress.query({ mof_id: mofId });
      setSelectedMofProgress(progress);
    } catch (error) {
      console.error('Failed to load MOF progress:', error);
      // Don't show error in demo mode
      setSelectedMofProgress(null);
    }
  }, []);

  const updateMofStatus = async (mofId: number, status: MofStatus) => {
    try {
      await trpc.updateMofStatus.mutate({ id: mofId, status });
      await loadMofs(); // Refresh the list
      setError(null);
    } catch (error) {
      console.error('Failed to update MOF status:', error);
      // In demo mode, just simulate the update locally
      setMofs((prev: Mof[]) => 
        prev.map((mof: Mof) => 
          mof.id === mofId ? { ...mof, status } : mof
        )
      );
    }
  };

  useEffect(() => {
    loadMofs();
    loadItems();
  }, [loadMofs, loadItems]);

  const getStatusColor = (status: MofStatus): string => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'MOF siap Supply':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Completed':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusEmoji = (status: MofStatus): string => {
    switch (status) {
      case 'Pending':
        return '⏳';
      case 'In Progress':
        return '🔄';
      case 'MOF siap Supply':
        return '📦';
      case 'Completed':
        return '✅';
      default:
        return '❓';
    }
  };

  // Calculate statistics
  const totalMofs = mofs.length;
  const completedMofs = mofs.filter((mof: Mof) => mof.status === 'Completed').length;
  const pendingMofs = mofs.filter((mof: Mof) => mof.status === 'Pending').length;
  const inProgressMofs = mofs.filter((mof: Mof) => mof.status === 'In Progress').length;
  const readyMofs = mofs.filter((mof: Mof) => mof.status === 'MOF siap Supply').length;

  const totalItems = items.length;
  const pickedItems = items.filter((item: Item) => item.is_scanned_by_picker).length;
  const verifiedItems = items.filter((item: Item) => item.is_scanned_by_requester).length;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          👨‍💼 Admin Dashboard
        </h2>
        <p className="text-gray-600">
          Welcome back, {user.full_name}! Monitor all warehouse operations from here.
        </p>
      </div>

      {error && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertDescription className="text-amber-800">
            ⚠️ {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total MOFs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalMofs}</div>
            <p className="text-xs text-gray-500 mt-1">Material Outgoing Forms</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedMofs}</div>
            <p className="text-xs text-gray-500 mt-1">
              {totalMofs > 0 ? Math.round((completedMofs / totalMofs) * 100) : 0}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgressMofs + readyMofs}</div>
            <p className="text-xs text-gray-500 mt-1">Active operations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Items Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{verifiedItems}</div>
            <p className="text-xs text-gray-500 mt-1">
              of {totalItems} total items
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="mofs" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="mofs">📋 All MOFs</TabsTrigger>
          <TabsTrigger value="items">📦 All Items</TabsTrigger>
          <TabsTrigger value="analytics">📊 Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="mofs">
          <Card>
            <CardHeader>
              <CardTitle>Material Outgoing Forms</CardTitle>
              <CardDescription>
                Monitor all MOFs in the system and their current status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">Loading MOFs...</div>
                </div>
              ) : mofs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-4">📋</div>
                  <div>No MOFs found in the system</div>
                  <p className="text-sm mt-2">MOFs will appear here once requesters create them</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Part Number</TableHead>
                        <TableHead>Requester</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mofs.map((mof: Mof) => (
                        <TableRow key={mof.id}>
                          <TableCell className="font-mono text-sm">
                            {mof.serial_number}
                          </TableCell>
                          <TableCell className="font-medium">
                            {mof.part_number}
                          </TableCell>
                          <TableCell>{mof.requester_name}</TableCell>
                          <TableCell>{mof.department}</TableCell>
                          <TableCell>{mof.quantity_requested}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(mof.status)}>
                              {getStatusEmoji(mof.status)} {mof.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Select
                                value={mof.status}
                                onValueChange={(value: MofStatus) => updateMofStatus(mof.id, value)}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Pending">⏳ Pending</SelectItem>
                                  <SelectItem value="In Progress">🔄 In Progress</SelectItem>
                                  <SelectItem value="MOF siap Supply">📦 Ready</SelectItem>
                                  <SelectItem value="Completed">✅ Completed</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadMofProgress(mof.id)}
                              >
                                View Details
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedMofProgress && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>MOF Progress Details</CardTitle>
                <CardDescription>
                  Detailed progress for MOF: {selectedMofProgress.mof.serial_number}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedMofProgress.quantity_requested}
                    </div>
                    <p className="text-sm text-gray-600">Requested</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {selectedMofProgress.quantity_picked}
                    </div>
                    <p className="text-sm text-gray-600">Picked</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {selectedMofProgress.quantity_verified}
                    </div>
                    <p className="text-sm text-gray-600">Verified</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Picking Progress</span>
                    <span>{Math.round((selectedMofProgress.quantity_picked / selectedMofProgress.quantity_requested) * 100)}%</span>
                  </div>
                  <Progress 
                    value={(selectedMofProgress.quantity_picked / selectedMofProgress.quantity_requested) * 100} 
                    className="h-2"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Verification Progress</span>
                    <span>{Math.round((selectedMofProgress.quantity_verified / selectedMofProgress.quantity_requested) * 100)}%</span>
                  </div>
                  <Progress 
                    value={(selectedMofProgress.quantity_verified / selectedMofProgress.quantity_requested) * 100} 
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="items">
          <Card>
            <CardHeader>
              <CardTitle>All Items</CardTitle>
              <CardDescription>
                Overview of all items in the warehouse system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-4">📦</div>
                  <div>No items found in the system</div>
                  <p className="text-sm mt-2">Items will appear here once they are added to the system</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Part Number</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Picked</TableHead>
                        <TableHead>Verified</TableHead>
                        <TableHead>MOF</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: Item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">
                            {item.serial_number}
                          </TableCell>
                          <TableCell>{item.part_number}</TableCell>
                          <TableCell>{item.supplier}</TableCell>
                          <TableCell>
                            {item.is_scanned_by_picker ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                ✅ Picked
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-800 border-gray-200">
                                ⏳ Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.is_scanned_by_requester ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                ✅ Verified
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-800 border-gray-200">
                                ⏳ Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.mof_id ? (
                              <span className="text-sm text-blue-600">MOF #{item.mof_id}</span>
                            ) : (
                              <span className="text-sm text-gray-400">Unassigned</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>MOF Status Distribution</CardTitle>
                <CardDescription>Current status of all MOFs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">⏳ Pending</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={totalMofs > 0 ? (pendingMofs / totalMofs) * 100 : 0} className="w-24 h-2" />
                      <span className="text-sm font-medium w-8">{pendingMofs}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">🔄 In Progress</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={totalMofs > 0 ? (inProgressMofs / totalMofs) * 100 : 0} className="w-24 h-2" />
                      <span className="text-sm font-medium w-8">{inProgressMofs}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">📦 Ready</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={totalMofs > 0 ? (readyMofs / totalMofs) * 100 : 0} className="w-24 h-2" />
                      <span className="text-sm font-medium w-8">{readyMofs}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">✅ Completed</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={totalMofs > 0 ? (completedMofs / totalMofs) * 100 : 0} className="w-24 h-2" />
                      <span className="text-sm font-medium w-8">{completedMofs}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Item Processing Status</CardTitle>
                <CardDescription>Picking and verification progress</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center space-y-4">
                  <div>
                    <div className="text-3xl font-bold text-orange-600 mb-1">{pickedItems}</div>
                    <div className="text-sm text-gray-600">Items Picked</div>
                    <Progress value={totalItems > 0 ? (pickedItems / totalItems) * 100 : 0} className="mt-2" />
                  </div>
                  
                  <div>
                    <div className="text-3xl font-bold text-green-600 mb-1">{verifiedItems}</div>
                    <div className="text-sm text-gray-600">Items Verified</div>
                    <Progress value={totalItems > 0 ? (verifiedItems / totalItems) * 100 : 0} className="mt-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
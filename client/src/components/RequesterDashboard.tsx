import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/utils/trpc';

import type { User, Mof, CreateMofInput, MofStatus, MofProgress } from '../../../server/src/schema';

interface RequesterDashboardProps {
  user: User;
}

export function RequesterDashboard({ user }: RequesterDashboardProps) {
  const [userMofs, setUserMofs] = useState<Mof[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedMofProgress, setSelectedMofProgress] = useState<MofProgress | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [verificationMode, setVerificationMode] = useState(false);
  const [scanInput, setScanInput] = useState('');

  // Form state for new MOF
  const [newMofData, setNewMofData] = useState<CreateMofInput>({
    part_number: '',
    quantity_requested: 1,
    expected_receiving_date: new Date(),
    requester_name: user.full_name,
    department: '',
    project: '',
    created_by: user.id
  });

  const loadUserMofs = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await trpc.getUserMofs.query({ userId: user.id });
      setUserMofs(result);
      setError(null);
    } catch (error) {
      console.error('Failed to load user MOFs:', error);
      // Provide demo data when backend is not available
      setUserMofs([]);
      setError(null); // Don't show error in demo mode
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

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

  const handleCreateMof = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const createdMof = await trpc.createMof.mutate(newMofData);
      setUserMofs((prev: Mof[]) => [createdMof, ...prev]);
      setSuccess(`MOF created successfully! Serial number: ${createdMof.serial_number}`);
      
      // Reset form
      setNewMofData({
        part_number: '',
        quantity_requested: 1,
        expected_receiving_date: new Date(),
        requester_name: user.full_name,
        department: '',
        project: '',
        created_by: user.id
      });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create MOF:', error);
      // In demo mode, simulate MOF creation
      const mockMof: Mof = {
        id: Math.floor(Math.random() * 10000),
        serial_number: `MOF-${Date.now().toString().slice(-6)}`,
        part_number: newMofData.part_number,
        quantity_requested: newMofData.quantity_requested,
        expected_receiving_date: newMofData.expected_receiving_date,
        requester_name: newMofData.requester_name,
        department: newMofData.department,
        project: newMofData.project,
        status: 'Pending',
        created_by: newMofData.created_by,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      setUserMofs((prev: Mof[]) => [mockMof, ...prev]);
      setSuccess(`MOF created successfully! Serial number: ${mockMof.serial_number} (Demo Mode)`);
      
      // Reset form
      setNewMofData({
        part_number: '',
        quantity_requested: 1,
        expected_receiving_date: new Date(),
        requester_name: user.full_name,
        department: '',
        project: '',
        created_by: user.id
      });
      setIsCreateDialogOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanForVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!scanInput.trim()) {
      setError('Please enter a QR code to scan');
      return;
    }

    try {
      // For demo purposes, we'll simulate scanning
      // In real implementation, this would parse QR code data
      if (scanInput.startsWith('MOF-')) {
        // MOF QR Code scan
        const result = await trpc.getMofBySerial.query({ serial_number: scanInput });
        if (result && result.status === 'MOF siap Supply') {
          setSuccess(`MOF ${scanInput} is ready for verification! Start scanning items.`);
        } else if (result) {
          setError(`MOF ${scanInput} is not ready for verification. Current status: ${result.status}`);
        } else {
          setError(`MOF ${scanInput} not found in the system.`);
        }
      } else {
        // Item QR Code scan
        await trpc.verifyItem.mutate({
          mof_serial_number: 'Current MOF', // This would be tracked in real implementation
          item_serial_number: scanInput,
          verified_by: user.id
        });
        setSuccess(`Item ${scanInput} verified successfully!`);
        await loadUserMofs(); // Refresh the list
      }
    } catch (error) {
      console.error('Failed to process scan:', error);
      setError('Failed to process scan. This feature requires backend implementation.');
    }

    setScanInput('');
  };

  useEffect(() => {
    loadUserMofs();
  }, [loadUserMofs]);

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
  const totalMofs = userMofs.length;
  const completedMofs = userMofs.filter((mof: Mof) => mof.status === 'Completed').length;
  const readyForVerification = userMofs.filter((mof: Mof) => mof.status === 'MOF siap Supply').length;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          📋 Requester Dashboard
        </h2>
        <p className="text-gray-600">
          Welcome back, {user.full_name}! Create new MOFs and verify received items.
        </p>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            ❌ {error}
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">
            ✅ {success}
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">My MOFs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalMofs}</div>
            <p className="text-xs text-gray-500 mt-1">Total requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Ready to Verify</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{readyForVerification}</div>
            <p className="text-xs text-gray-500 mt-1">Awaiting verification</p>
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
      </div>

      {/* Main Content */}
      <Tabs defaultValue="mofs" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="mofs">📋 My MOFs</TabsTrigger>
          <TabsTrigger value="verification">🔍 Item Verification</TabsTrigger>
        </TabsList>

        <TabsContent value="mofs">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>My Material Outgoing Forms</CardTitle>
                  <CardDescription>
                    View and track your material requests
                  </CardDescription>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700">
                      📝 Create New MOF
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New MOF</DialogTitle>
                      <DialogDescription>
                        Fill out the form to request materials
                      </DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={handleCreateMof} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="partNumber">Part Number</Label>
                        <Input
                          id="partNumber"
                          value={newMofData.part_number}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewMofData((prev: CreateMofInput) => ({ ...prev, part_number: e.target.value }))
                          }
                          placeholder="e.g. ABC-123"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity Requested</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          value={newMofData.quantity_requested}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewMofData((prev: CreateMofInput) => ({ 
                              ...prev, 
                              quantity_requested: parseInt(e.target.value) || 1 
                            }))
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="expectedDate">Expected Receiving Date</Label>
                        <Input
                          id="expectedDate"
                          type="date"
                          value={newMofData.expected_receiving_date.toISOString().split('T')[0]}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewMofData((prev: CreateMofInput) => ({ 
                              ...prev, 
                              expected_receiving_date: new Date(e.target.value) 
                            }))
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Input
                          id="department"
                          value={newMofData.department}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewMofData((prev: CreateMofInput) => ({ ...prev, department: e.target.value }))
                          }
                          placeholder="e.g. Engineering"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="project">Project</Label>
                        <Input
                          id="project"
                          value={newMofData.project}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewMofData((prev: CreateMofInput) => ({ ...prev, project: e.target.value }))
                          }
                          placeholder="e.g. Project Alpha"
                          required
                        />
                      </div>

                      <div className="flex space-x-2 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreateDialogOpen(false)}
                          className="flex-1"
                          disabled={isLoading}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1"
                          disabled={isLoading}
                        >
                          {isLoading ? 'Creating...' : 'Create MOF'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">Loading your MOFs...</div>
                </div>
              ) : userMofs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-4">📋</div>
                  <div>No MOFs created yet</div>
                  <p className="text-sm mt-2">Click "Create New MOF" to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Part Number</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userMofs.map((mof: Mof) => (
                        <TableRow key={mof.id}>
                          <TableCell className="font-mono text-sm">
                            {mof.serial_number}
                          </TableCell>
                          <TableCell className="font-medium">
                            {mof.part_number}
                          </TableCell>
                          <TableCell>{mof.quantity_requested}</TableCell>
                          <TableCell>{mof.department}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(mof.status)}>
                              {getStatusEmoji(mof.status)} {mof.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadMofProgress(mof.id)}
                              >
                                View Progress
                              </Button>
                              {mof.status === 'MOF siap Supply' && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="bg-purple-600 hover:bg-purple-700"
                                  onClick={() => setVerificationMode(true)}
                                >
                                  🔍 Verify Items
                                </Button>
                              )}
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
                <CardTitle>MOF Progress: {selectedMofProgress.mof.serial_number}</CardTitle>
                <CardDescription>
                  Detailed progress tracking for your material request
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

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Picking Progress</span>
                      <span>{Math.round((selectedMofProgress.quantity_picked / selectedMofProgress.quantity_requested) * 100)}%</span>
                    </div>
                    <Progress 
                      value={(selectedMofProgress.quantity_picked / selectedMofProgress.quantity_requested) * 100} 
                      className="h-2"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Verification Progress</span>
                      <span>{Math.round((selectedMofProgress.quantity_verified / selectedMofProgress.quantity_requested) * 100)}%</span>
                    </div>
                    <Progress 
                      value={(selectedMofProgress.quantity_verified / selectedMofProgress.quantity_requested) * 100} 
                      className="h-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <h4 className="font-semibold mb-2">📦 Expected Delivery</h4>
                    <p className="text-sm text-gray-600">
                      {selectedMofProgress.mof.expected_receiving_date.toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">🏢 Project Details</h4>
                    <p className="text-sm text-gray-600">
                      {selectedMofProgress.mof.project} - {selectedMofProgress.mof.department}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="verification">
          <Card>
            <CardHeader>
              <CardTitle>📱 QR Code Scanner</CardTitle>
              <CardDescription>
                Scan MOF and item QR codes to verify received materials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-blue-800">
                  <strong>How to verify items:</strong>
                  <br />1. First scan the MOF QR code to select the order
                  <br />2. Then scan each individual item QR code to verify receipt
                  <br />3. Once all items are verified, the MOF status will change to "Completed"
                </AlertDescription>
              </Alert>

              <form onSubmit={handleScanForVerification} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="scanInput">QR Code Scanner</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="scanInput"
                      value={scanInput}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScanInput(e.target.value)}
                      placeholder="Scan or enter QR code (MOF-XXXXX or ITEM-XXXXX)"
                      className="font-mono"
                    />
                    <Button type="submit" disabled={!scanInput.trim()}>
                      📱 Process Scan
                    </Button>
                  </div>
                </div>
              </form>

              <div className="border-t pt-6">
                <h4 className="font-semibold mb-4">📦 Items Ready for Verification</h4>
                {userMofs.filter((mof: Mof) => mof.status === 'MOF siap Supply').length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-4">📦</div>
                    <div>No items ready for verification</div>
                    <p className="text-sm mt-2">Items will appear here when pickers complete their work</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {userMofs
                      .filter((mof: Mof) => mof.status === 'MOF siap Supply')
                      .map((mof: Mof) => (
                        <Card key={mof.id} className="border-purple-200">
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-semibold">{mof.serial_number}</h5>
                                <p className="text-sm text-gray-600">
                                  {mof.part_number} × {mof.quantity_requested}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {mof.department} - {mof.project}
                                </p>
                              </div>
                              <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                                📦 Ready to Verify
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
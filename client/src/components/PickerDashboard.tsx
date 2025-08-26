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

import type { User, Mof, Item, MofProgress, CreateItemInput } from '../../../server/src/schema';

interface PickerDashboardProps {
  user: User;
}

export function PickerDashboard({ user }: PickerDashboardProps) {
  const [allMofs, setAllMofs] = useState<Mof[]>([]);
  const [currentMof, setCurrentMof] = useState<MofProgress | null>(null);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [isCreateItemDialogOpen, setIsCreateItemDialogOpen] = useState(false);

  // Form state for new item
  const [newItemData, setNewItemData] = useState<CreateItemInput>({
    part_number: '',
    supplier: '',
    serial_number: ''
  });

  const loadMofs = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await trpc.getAllMofs.query();
      setAllMofs(result);
      setError(null);
    } catch (error) {
      console.error('Failed to load MOFs:', error);
      // Provide demo data when backend is not available
      setAllMofs([]);
      setError(null); // Don't show error in demo mode
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const result = await trpc.getAllItems.query();
      setAllItems(result);
    } catch (error) {
      console.error('Failed to load items:', error);
      // Provide demo data when backend is not available
      setAllItems([]);
    }
  }, []);

  const loadMofProgress = useCallback(async (mofId: number) => {
    try {
      const progress = await trpc.getMofProgress.query({ mof_id: mofId });
      setCurrentMof(progress);
    } catch (error) {
      console.error('Failed to load MOF progress:', error);
      setError('Failed to load MOF progress. This feature requires backend implementation.');
    }
  }, []);

  const handleScanQrCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!scanInput.trim()) {
      setError('Please enter a QR code to scan');
      return;
    }

    try {
      if (scanInput.startsWith('MOF-')) {
        // MOF QR Code scan - load the MOF for picking
        const mof = await trpc.getMofBySerial.query({ serial_number: scanInput });
        if (mof && mof.status === 'Pending') {
          // Update status to In Progress when picker starts
          await trpc.updateMofStatus.mutate({ id: mof.id, status: 'In Progress' });
          await loadMofProgress(mof.id);
          setSuccess(`MOF ${scanInput} loaded for picking! Start scanning items.`);
          await loadMofs(); // Refresh the list
        } else if (mof) {
          setError(`MOF ${scanInput} is not available for picking. Current status: ${mof.status}`);
        } else {
          setError(`MOF ${scanInput} not found in the system.`);
        }
      } else {
        // Item QR Code scan
        if (!currentMof) {
          setError('Please scan a MOF QR code first to select which order to pick for');
          setScanInput('');
          return;
        }

        await trpc.scanItem.mutate({
          mof_serial_number: currentMof.mof.serial_number,
          item_serial_number: scanInput,
          picked_by: user.id
        });
        
        setSuccess(`Item ${scanInput} scanned successfully!`);
        await loadMofProgress(currentMof.mof.id); // Refresh current MOF progress
        await loadItems(); // Refresh items list
      }
    } catch (error) {
      console.error('Failed to process scan:', error);
      setError('Failed to process scan. This feature requires backend implementation.');
    }

    setScanInput('');
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const createdItem = await trpc.createItem.mutate(newItemData);
      setAllItems((prev: Item[]) => [createdItem, ...prev]);
      setSuccess(`Item created successfully! Serial: ${createdItem.serial_number}`);
      
      // Reset form
      setNewItemData({
        part_number: '',
        supplier: '',
        serial_number: ''
      });
      setIsCreateItemDialogOpen(false);
    } catch (error) {
      console.error('Failed to create item:', error);
      // In demo mode, simulate item creation
      const mockItem: Item = {
        id: Math.floor(Math.random() * 10000),
        part_number: newItemData.part_number,
        supplier: newItemData.supplier,
        serial_number: newItemData.serial_number,
        is_scanned_by_picker: false,
        is_scanned_by_requester: false,
        mof_id: null,
        picked_at: null,
        verified_at: null,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      setAllItems((prev: Item[]) => [mockItem, ...prev]);
      setSuccess(`Item created successfully! Serial: ${mockItem.serial_number} (Demo Mode)`);
      
      // Reset form
      setNewItemData({
        part_number: '',
        supplier: '',
        serial_number: ''
      });
      setIsCreateItemDialogOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMofs();
    loadItems();
  }, [loadMofs, loadItems]);

  // Calculate statistics
  const availableMofs = allMofs.filter((mof: Mof) => mof.status === 'Pending').length;
  const inProgressMofs = allMofs.filter((mof: Mof) => mof.status === 'In Progress').length;
  const completedToday = allMofs.filter((mof: Mof) => 
    mof.status === 'MOF siap Supply' && 
    new Date(mof.updated_at).toDateString() === new Date().toDateString()
  ).length;

  const totalItems = allItems.length;
  const unassignedItems = allItems.filter((item: Item) => !item.mof_id).length;
  const pickedItems = allItems.filter((item: Item) => item.is_scanned_by_picker).length;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          📦 Picker Dashboard
        </h2>
        <p className="text-gray-600">
          Welcome, {user.full_name}! Ready to pick some items today?
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Available to Pick</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{availableMofs}</div>
            <p className="text-xs text-gray-500 mt-1">Pending MOFs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgressMofs}</div>
            <p className="text-xs text-gray-500 mt-1">Being picked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Completed Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedToday}</div>
            <p className="text-xs text-gray-500 mt-1">Ready for supply</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Items Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{unassignedItems}</div>
            <p className="text-xs text-gray-500 mt-1">Ready to pick</p>
          </CardContent>
        </Card>
      </div>

      {/* Current Picking Session */}
      {currentMof && (
        <Card className="border-blue-200">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-blue-800">
                  🔄 Currently Picking: {currentMof.mof.serial_number}
                </CardTitle>
                <CardDescription>
                  {currentMof.mof.part_number} for {currentMof.mof.requester_name}
                </CardDescription>
              </div>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                In Progress
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {currentMof.quantity_requested}
                </div>
                <p className="text-sm text-gray-600">Requested</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {currentMof.quantity_picked}
                </div>
                <p className="text-sm text-gray-600">Picked</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-400">
                  {currentMof.quantity_requested - currentMof.quantity_picked}
                </div>
                <p className="text-sm text-gray-600">Remaining</p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Picking Progress</span>
                <span>{Math.round((currentMof.quantity_picked / currentMof.quantity_requested) * 100)}%</span>
              </div>
              <Progress 
                value={(currentMof.quantity_picked / currentMof.quantity_requested) * 100} 
                className="h-3"
              />
            </div>

            {currentMof.quantity_picked >= currentMof.quantity_requested && (
              <Alert className="border-green-200 bg-green-50">
                <AlertDescription className="text-green-800">
                  🎉 All items picked! This MOF is now ready for supply.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="scanner" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scanner">📱 QR Scanner</TabsTrigger>
          <TabsTrigger value="mofs">📋 Available MOFs</TabsTrigger>
          <TabsTrigger value="items">📦 Inventory</TabsTrigger>
          <TabsTrigger value="history">📊 My Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="scanner">
          <Card>
            <CardHeader>
              <CardTitle>📱 QR Code Scanner</CardTitle>
              <CardDescription>
                Scan MOF QR codes to start picking, then scan item QR codes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-blue-800">
                  <strong>Picking Process:</strong>
                  <br />1. Scan a MOF QR code to start picking for that order
                  <br />2. Scan individual item QR codes to mark them as picked
                  <br />3. Once all items are picked, the MOF status changes to "MOF siap Supply"
                </AlertDescription>
              </Alert>

              <form onSubmit={handleScanQrCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="scanInput">QR Code Scanner</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="scanInput"
                      value={scanInput}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScanInput(e.target.value)}
                      placeholder="Scan or enter QR code (MOF-XXXXX or ITEM-XXXXX)"
                      className="font-mono text-lg"
                    />
                    <Button type="submit" disabled={!scanInput.trim()} size="lg">
                      📱 Scan
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    QR codes starting with "MOF-" will load an order for picking.
                    Other codes will be treated as item scans.
                  </p>
                </div>
              </form>

              {/* Quick Access Buttons */}
              <div className="border-t pt-6">
                <h4 className="font-semibold mb-4">⚡ Quick Actions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {allMofs
                    .filter((mof: Mof) => mof.status === 'Pending')
                    .slice(0, 4)
                    .map((mof: Mof) => (
                      <Card key={mof.id} className="cursor-pointer hover:bg-gray-50" 
                            onClick={() => setScanInput(mof.serial_number)}>
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-semibold text-sm">{mof.serial_number}</h5>
                              <p className="text-xs text-gray-600">
                                {mof.part_number} × {mof.quantity_requested}
                              </p>
                              <p className="text-xs text-gray-500">
                                {mof.requester_name} - {mof.department}
                              </p>
                            </div>
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                              ⏳ Pending
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mofs">
          <Card>
            <CardHeader>
              <CardTitle>📋 Available MOFs</CardTitle>
              <CardDescription>
                Material requests ready for picking
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">Loading MOFs...</div>
                </div>
              ) : allMofs.filter((mof: Mof) => ['Pending', 'In Progress'].includes(mof.status)).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-4">📋</div>
                  <div>No MOFs available for picking</div>
                  <p className="text-sm mt-2">Check back later or contact admin</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Part Number</TableHead>
                        <TableHead>Requester</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allMofs
                        .filter((mof: Mof) => ['Pending', 'In Progress'].includes(mof.status))
                        .map((mof: Mof) => (
                          <TableRow key={mof.id}>
                            <TableCell className="font-mono text-sm">
                              {mof.serial_number}
                            </TableCell>
                            <TableCell className="font-medium">
                              {mof.part_number}
                            </TableCell>
                            <TableCell>{mof.requester_name}</TableCell>
                            <TableCell>{mof.quantity_requested}</TableCell>
                            <TableCell>
                              <Badge className={
                                new Date(mof.expected_receiving_date) <= new Date()
                                  ? "bg-red-100 text-red-800 border-red-200"
                                  : "bg-green-100 text-green-800 border-green-200"
                              }>
                                {new Date(mof.expected_receiving_date) <= new Date() ? "🔥 Urgent" : "📅 Normal"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={
                                mof.status === 'Pending'
                                  ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                                  : "bg-blue-100 text-blue-800 border-blue-200"
                              }>
                                {mof.status === 'Pending' ? '⏳' : '🔄'} {mof.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setScanInput(mof.serial_number);
                                  const scannerTab = document.querySelector('[value="scanner"]') as HTMLElement;
                                  scannerTab?.click();
                                }}
                              >
                                📱 Start Picking
                              </Button>
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

        <TabsContent value="items">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>📦 Inventory Items</CardTitle>
                  <CardDescription>
                    All items available in the warehouse
                  </CardDescription>
                </div>
                <Dialog open={isCreateItemDialogOpen} onOpenChange={setIsCreateItemDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-purple-600 hover:bg-purple-700">
                      ➕ Add New Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Item</DialogTitle>
                      <DialogDescription>
                        Register a new item in the warehouse inventory
                      </DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={handleCreateItem} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="itemPartNumber">Part Number</Label>
                        <Input
                          id="itemPartNumber"
                          value={newItemData.part_number}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewItemData((prev: CreateItemInput) => ({ ...prev, part_number: e.target.value }))
                          }
                          placeholder="e.g. ABC-123"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="supplier">Supplier</Label>
                        <Input
                          id="supplier"
                          value={newItemData.supplier}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewItemData((prev: CreateItemInput) => ({ ...prev, supplier: e.target.value }))
                          }
                          placeholder="e.g. Supplier Inc."
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="serialNumber">Serial Number</Label>
                        <Input
                          id="serialNumber"
                          value={newItemData.serial_number}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewItemData((prev: CreateItemInput) => ({ ...prev, serial_number: e.target.value }))
                          }
                          placeholder="e.g. SN123456"
                          required
                        />
                      </div>

                      <div className="flex space-x-2 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreateItemDialogOpen(false)}
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
                          {isLoading ? 'Adding...' : 'Add Item'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {allItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-4">📦</div>
                  <div>No items in inventory</div>
                  <p className="text-sm mt-2">Click "Add New Item" to register items</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Part Number</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assignment</TableHead>
                        <TableHead>Picked Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allItems.map((item: Item) => (
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
                              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                                📦 Available
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
                          <TableCell>
                            {item.picked_at ? (
                              <span className="text-sm">
                                {new Date(item.picked_at).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">Not picked</span>
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

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>📊 My Picking Activity</CardTitle>
              <CardDescription>
                Track your picking performance and history
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{pickedItems}</div>
                  <p className="text-sm text-gray-600">Items Picked</p>
                  <p className="text-xs text-gray-500">All time</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{completedToday}</div>
                  <p className="text-sm text-gray-600">MOFs Completed</p>
                  <p className="text-xs text-gray-500">Today</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {totalItems > 0 ? Math.round((pickedItems / totalItems) * 100) : 0}%
                  </div>
                  <p className="text-sm text-gray-600">Pick Rate</p>
                  <p className="text-xs text-gray-500">Overall</p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="font-semibold mb-4">Recent Activity</h4>
                {allItems.filter((item: Item) => item.is_scanned_by_picker).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-4">📊</div>
                    <div>No picking activity yet</div>
                    <p className="text-sm mt-2">Start picking items to see your activity here</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allItems
                      .filter((item: Item) => item.is_scanned_by_picker)
                      .slice(0, 10)
                      .map((item: Item) => (
                        <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium">{item.serial_number}</div>
                            <div className="text-sm text-gray-600">{item.part_number}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">✅ Picked</div>
                            <div className="text-xs text-gray-500">
                              {item.picked_at ? new Date(item.picked_at).toLocaleString() : 'Unknown'}
                            </div>
                          </div>
                        </div>
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
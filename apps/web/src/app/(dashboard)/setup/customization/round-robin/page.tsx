"use client";

import * as React from "react";
import { Users, UserPlus, UserMinus, AlertTriangle, Settings } from "lucide-react";
import { roundRobinApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Member {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
    profile?: { id: string; name: string } | null;
  };
  isActive: boolean;
  poolType: string;
  createdAt: string;
}

interface EligibleUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profile?: { id: string; name: string } | null;
}

const POOL_TYPES = [
  { key: "PRESALES", label: "Presales Round Robin", description: "Assigns incoming leads to Presales team members" },
  { key: "SVC", label: "SVC Round Robin", description: "Assigns leads pushed from Presales to SVC team members" },
  { key: "SALES", label: "Sales Round Robin", description: "Assigns leads after site visit to Sales team members" },
] as const;

export default function RoundRobinPage() {
  const { toast } = useToast();
  const [members, setMembers] = React.useState<Record<string, Member[]>>({ PRESALES: [], SVC: [], SALES: [] });
  const [loading, setLoading] = React.useState(true);
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = React.useState(false);
  const [selectedPool, setSelectedPool] = React.useState<string>("");
  const [eligibleUsers, setEligibleUsers] = React.useState<EligibleUser[]>([]);
  const [selectedUserId, setSelectedUserId] = React.useState<string>("");
  const [removingMember, setRemovingMember] = React.useState<Member | null>(null);
  const [saving, setSaving] = React.useState(false);

  const loadMembers = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await roundRobinApi.getAll();
      setMembers(response.data.data);
    } catch (error: any) {
      toast({ title: "Failed to load Round Robin configuration", description: error?.response?.data?.error || "Try again.", variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { void loadMembers(); }, [loadMembers]);

  const openAddDialog = async (poolType: string) => {
    setSelectedPool(poolType);
    setSelectedUserId("");
    try {
      const response = await roundRobinApi.getEligible(poolType);
      setEligibleUsers(response.data.data || []);
    } catch {
      setEligibleUsers([]);
    }
    setAddDialogOpen(true);
  };

  const handleAdd = async () => {
    if (!selectedUserId || !selectedPool) return;
    try {
      setSaving(true);
      await roundRobinApi.addMember(selectedUserId, selectedPool);
      setAddDialogOpen(false);
      await loadMembers();
      toast({ title: "Member added", description: "User added to Round Robin pool." });
    } catch (error: any) {
      toast({ title: "Failed to add member", description: error?.response?.data?.error || "Try again.", variant: "destructive" as any });
    } finally {
      setSaving(false);
    }
  };

  const openRemoveDialog = (member: Member) => {
    setRemovingMember(member);
    setRemoveDialogOpen(true);
  };

  const handleRemove = async () => {
    if (!removingMember) return;
    try {
      setSaving(true);
      await roundRobinApi.removeMember(removingMember.id);
      setRemoveDialogOpen(false);
      setRemovingMember(null);
      await loadMembers();
      toast({ title: "Member removed", description: "User removed from Round Robin pool." });
    } catch (error: any) {
      toast({ title: "Failed to remove member", description: error?.response?.data?.error || "Try again.", variant: "destructive" as any });
    } finally {
      setSaving(false);
    }
  };

  const getMemberCount = (poolType: string) => {
    return (members[poolType] || []).filter((m) => m.isActive).length;
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <a href="/setup" className="hover:underline">Setup</a>
          <span>/</span>
          <a href="/setup/customization" className="hover:underline">Customization</a>
          <span>/</span>
          <span>Round Robin</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Round Robin Configuration
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure automatic lead assignment pools for Presales, SVC, and Sales teams.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading configuration...</div>
        </div>
      ) : (
        <div className="grid gap-6">
          {POOL_TYPES.map(({ key, label, description }) => (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {label}
                    <Badge variant="secondary">{getMemberCount(key)} members</Badge>
                  </CardTitle>
                  <CardDescription>{description}</CardDescription>
                </div>
                <Button size="sm" onClick={() => openAddDialog(key)}>
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add User
                </Button>
              </CardHeader>
              <CardContent>
                {(members[key] || []).length === 0 ? (
                  <div className="flex items-center gap-2 py-6 text-muted-foreground justify-center">
                    <AlertTriangle className="h-4 w-4" />
                    No members configured. Add users to enable automatic lead assignment.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Profile</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[80px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(members[key] || []).map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">
                            {member.user.firstName} {member.user.lastName}
                          </TableCell>
                          <TableCell>{member.user.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{member.user.profile?.name || "No Profile"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={member.user.isActive ? "default" : "destructive"}>
                              {member.user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openRemoveDialog(member)}
                              className="text-destructive hover:text-destructive"
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User to {POOL_TYPES.find((p) => p.key === selectedPool)?.label}</DialogTitle>
            <DialogDescription>
              Select an eligible user to add to this Round Robin pool.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {eligibleUsers.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No eligible users available for this pool.
              </div>
            ) : (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!selectedUserId || saving}>
              {saving ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from Round Robin</DialogTitle>
            <DialogDescription>
              Remove {removingMember?.user.firstName} {removingMember?.user.lastName} from this pool?
              Existing leads owned by this user will not be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemove} disabled={saving}>
              {saving ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Plus } from "lucide-react"

interface CreditTransaction {
  id: string
  amount: number
  type: string
  description: string | null
  createdAt: string
  user: {
    id: string
    email: string
    name: string | null
  }
}

interface User {
  id: string
  email: string
  name: string | null
  credits: number
}

export default function CreditsPage() {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState("")
  const [creditAmount, setCreditAmount] = useState("")
  const [description, setDescription] = useState("")

  useEffect(() => {
    fetchTransactions()
    fetchUsers()
  }, [])

  const fetchTransactions = async () => {
    try {
      const response = await fetch("/api/admin/credits")
      if (response.ok) {
        const data = await response.json()
        setTransactions(data)
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users")
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error("Failed to fetch users:", error)
    }
  }

  const handleAddCredits = async () => {
    if (!selectedUserId || !creditAmount) return

    try {
      const response = await fetch("/api/admin/credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedUserId,
          amount: parseInt(creditAmount),
          description: description || "Admin credit adjustment",
        }),
      })

      if (response.ok) {
        await fetchTransactions()
        await fetchUsers()
        setIsAddDialogOpen(false)
        setSelectedUserId("")
        setCreditAmount("")
        setDescription("")
      }
    } catch (error) {
      console.error("Failed to add credits:", error)
    }
  }

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case "BONUS":
        return "default"
      case "PURCHASE":
        return "secondary"
      case "IMAGE_DESCRIPTION":
      case "BULK_DESCRIPTION":
        return "destructive"
      case "ADMIN_ADJUSTMENT":
        return "outline"
      default:
        return "secondary"
    }
  }

  const filteredTransactions = transactions.filter(transaction =>
    transaction.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transaction.user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transaction.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading credit transactions...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Credit Management</h2>
          <p className="text-muted-foreground">
            Monitor and manage user credits and transactions.
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Credits
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Credits to User</DialogTitle>
              <DialogDescription>
                Grant additional credits to a user account
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="user" className="text-right">
                  User
                </Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email} ({user.credits} credits)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">
                  Amount
                </Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter credit amount"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Optional description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddCredits}>Add Credits</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credit Transactions</CardTitle>
          <CardDescription>
            View all credit transactions across the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{transaction.user.name || "No name"}</div>
                      <div className="text-sm text-muted-foreground">{transaction.user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={transaction.amount > 0 ? "text-green-600" : "text-red-600"}>
                      {transaction.amount > 0 ? "+" : ""}{transaction.amount}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getTransactionTypeColor(transaction.type)}>
                      {transaction.type.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{transaction.description || "No description"}</TableCell>
                  <TableCell>
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
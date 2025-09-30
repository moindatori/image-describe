"use client"

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface Setting {
  id: string;
  key: string;
  value: string;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Form state for new/edit setting
  const [formData, setFormData] = useState({
    key: '',
    value: '',
    category: 'API'
  });

  // Predefined API keys that can be managed
  const predefinedKeys = [
    { key: 'IDEOGRAM_API_KEY', label: 'Ideogram API Key', category: 'API' },
    { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', category: 'API' },
    { key: 'CLOUDINARY_API_KEY', label: 'Cloudinary API Key', category: 'API' }
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      } else {
        throw new Error('Failed to fetch settings');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.key || !formData.value) {
      setMessage({ type: 'error', text: 'Key and value are required' });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Setting updated successfully' });
        setFormData({ key: '', value: '', category: 'API' });
        fetchSettings(); // Refresh the list
      } else {
        throw new Error('Failed to update setting');
      }
    } catch (error) {
      console.error('Error updating setting:', error);
      setMessage({ type: 'error', text: 'Failed to update setting' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Are you sure you want to delete the setting "${key}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/settings?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Setting deleted successfully' });
        fetchSettings(); // Refresh the list
      } else {
        throw new Error('Failed to delete setting');
      }
    } catch (error) {
      console.error('Error deleting setting:', error);
      setMessage({ type: 'error', text: 'Failed to delete setting' });
    }
  };

  const handlePredefinedKeySelect = (predefinedKey: { key: string; label: string; category: string }) => {
    const existingSetting = settings.find(s => s.key === predefinedKey.key);
    setFormData({
      key: predefinedKey.key,
      value: existingSetting?.value || '',
      category: predefinedKey.category
    });
  };

  const maskApiKey = (value: string) => {
    if (value.length <= 8) return value;
    return value.substring(0, 4) + '•'.repeat(value.length - 8) + value.substring(value.length - 4);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings Management</h1>
        <p className="text-gray-600 mt-2">Manage API keys and system configuration</p>
      </div>

      {message && (
        <Alert className={message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
          <AlertDescription className={message.type === 'error' ? 'text-red-800' : 'text-green-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add/Edit Setting Form */}
        <Card>
          <CardHeader>
            <CardTitle>Add/Update Setting</CardTitle>
            <CardDescription>
              Add a new setting or update an existing one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="key">Setting Key</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="e.g., IDEOGRAM_API_KEY"
                  required
                />
              </div>

              <div>
                <Label htmlFor="value">Setting Value</Label>
                <Input
                  id="value"
                  type="password"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="Enter the API key or setting value"
                  required
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="API">API</option>
                  <option value="GENERAL">General</option>
                  <option value="EMAIL">Email</option>
                  <option value="PAYMENT">Payment</option>
                </select>
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? 'Saving...' : 'Save Setting'}
              </Button>
            </form>

            {/* Quick Select Predefined Keys */}
            <div className="mt-6 pt-6 border-t">
              <Label className="text-sm font-medium text-gray-700 mb-3 block">
                Quick Select Common API Keys:
              </Label>
              <div className="flex flex-wrap gap-2">
                {predefinedKeys.map((predefined) => (
                  <Button
                    key={predefined.key}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePredefinedKeySelect(predefined)}
                    className="text-xs"
                  >
                    {predefined.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Settings List */}
        <Card>
          <CardHeader>
            <CardTitle>Current Settings</CardTitle>
            <CardDescription>
              Manage existing configuration settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {settings.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No settings configured yet</p>
            ) : (
              <div className="space-y-3">
                {settings.map((setting) => (
                  <div
                    key={setting.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{setting.key}</span>
                        <Badge variant="secondary" className="text-xs">
                          {setting.category}
                        </Badge>
                        {setting.isActive && (
                          <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-mono">
                        {maskApiKey(setting.value)}
                      </p>
                      <p className="text-xs text-gray-400">
                        Updated: {new Date(setting.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePredefinedKeySelect({
                          key: setting.key,
                          label: setting.key,
                          category: setting.category
                        })}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(setting.key)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
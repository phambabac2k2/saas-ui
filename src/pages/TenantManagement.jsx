import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  MoreVertical,
  Plus,
  RefreshCw,
  ExternalLink,
  Users,
  Check,
  Ban,
  TrendingUp,
  TrendingDown,
  Clock,
  Slash,
  ChevronRight
} from 'lucide-react';
import { getTenants, approveTenant, patchTenant } from '@/api/tenant';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ConfirmDialog';
import Pagination from '@/components/Pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const TenantManagement = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const [page, setPage] = useState(0);
  const [size] = useState(10);

  const { data: tenantsData, isLoading: loading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => getTenants({ size: 1000 }),
    placeholderData: keepPreviousData
  });

  const tenants = tenantsData?.content || [];

  useEffect(() => {
    setPage(0);
  }, [searchTerm]);

  const approveMutation = useMutation({
    mutationFn: approveTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
    onError: (error) => {
      console.error('Error approving tenant:', error);
    }
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }) => {
      await patchTenant(action, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
    onError: (error) => {
      console.error('Error updating tenant:', error);
    }
  });

  const handleApprove = (id) => {
    approveMutation.mutate(id);
  };

  const handleAction = (id, action) => {
    actionMutation.mutate({ id, action });
  };

  const showConfirm = (id, companyName, action) => {
    setConfirmTarget({ id, companyName, action });
    setConfirmOpen(true);
  };

  const handleConfirmAction = () => {
    if (!confirmTarget) return;
    const { id, action } = confirmTarget;
    if (action === 'approve') {
      approveMutation.mutate(id);
    } else {
      actionMutation.mutate({ id, action });
    }
    setConfirmOpen(false);
  };

  const getDialogDetails = () => {
    if (!confirmTarget) return { title: '', description: '', confirmText: '', variant: 'warning' };
    const { companyName, action } = confirmTarget;
    switch (action) {
      case 'approve':
        return {
          title: 'Approve Tenant?',
          description: `Are you sure you want to approve "${companyName}"? This will create and provision their tenant workspace.`,
          confirmText: 'Yes, approve',
          variant: 'success',
        };
      case 'activate':
        return {
          title: 'Activate Tenant?',
          description: `Are you sure you want to activate the tenant workspace for "${companyName}"? They will regain system access immediately.`,
          confirmText: 'Yes, activate',
          variant: 'success',
        };
      case 'deactivate':
        return {
          title: 'Deactivate Tenant?',
          description: `Are you sure you want to deactivate the tenant workspace for "${companyName}"? Users from this organization will not be able to log in.`,
          confirmText: 'Yes, deactivate',
          variant: 'warning',
        };
      case 'suspend':
        return {
          title: 'Suspend Tenant?',
          description: `Are you sure you want to suspend the tenant workspace for "${companyName}"? This will restrict all organization features and block access immediately.`,
          confirmText: 'Yes, suspend',
          variant: 'danger',
        };
      default:
        return { title: '', description: '', confirmText: '', variant: 'warning' };
    }
  };

  const dialogDetails = getDialogDetails();

  // Real data calculations
  const stats = useMemo(() => {
    const total = tenants.length;
    const activeTenants = tenants.filter(t => t.status === 'ACTIVE');
    const pendingTenants = tenants.filter(t => t.status === 'PENDING');
    const suspendedTenants = tenants.filter(t => t.status === 'SUSPENDED');
    const inactiveTenants = tenants.filter(t => t.status === 'INACTIVE');

    const active = activeTenants.length;
    const pending = pendingTenants.length;
    const suspended = suspendedTenants.length;
    const inactive = inactiveTenants.length;

    // Real trend calculation
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const getCountByMonth = (list, month, year) => {
      return list.filter(item => {
        const d = new Date(item.createdAt || item.dateMvt);
        return !isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year;
      }).length;
    };

    const calculateTrend = (list) => {
      const current = getCountByMonth(list, currentMonth, currentYear);
      const previous = getCountByMonth(list, lastMonth, lastMonthYear);
      if (previous === 0) return current > 0 ? '+100%' : '0%';
      const diff = ((current - previous) / previous) * 100;
      return `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`;
    };

    return {
      total, active, pending, suspended, inactive,
      totalTrend: calculateTrend(tenants),
      activeTrend: calculateTrend(activeTenants),
      pendingTrend: calculateTrend(pendingTenants),
      suspendedTrend: calculateTrend(suspendedTenants)
    };
  }, [tenants]);

  // Real data for chart (Group by month)
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIndex = new Date().getMonth();
    const last6Months = [];

    for (let i = 5; i >= 0; i--) {
      const idx = (currentMonthIndex - i + 12) % 12;
      last6Months.push({ month: months[idx], count: 0, monthNum: idx });
    }

    tenants.forEach(t => {
      const dateStr = t.createdAt || t.dateMvt;
      if (dateStr) {
        const date = new Date(dateStr);
        const monthIdx = date.getMonth();
        const chartItem = last6Months.find(m => m.monthNum === monthIdx);
        if (chartItem) chartItem.count++;
      }
    });

    const maxCount = Math.max(...last6Months.map(m => m.count), 1);
    return last6Months.map(m => ({
      ...m,
      height: `${(m.count / maxCount) * 85 + 5}%`,
      active: m.count > 0
    }));
  }, [tenants]);

  const getStatusBadge = (status) => {

    switch (status) {
      case 'ACTIVE':
        return (
          <div className="inline-flex items-center justify-center gap-2 text-[#10b981] font-bold text-[11px] bg-emerald-50/50 px-3 py-1 rounded-full border border-emerald-100/50 min-w-[90px]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></div> Active
          </div>
        );
      case 'PENDING':
        return (
          <div className="inline-flex items-center justify-center gap-2 text-[#f59e0b] font-bold text-[11px] bg-amber-50/50 px-3 py-1 rounded-full border border-amber-100/50 min-w-[90px]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></div> Pending
          </div>
        );
      case 'SUSPENDED':
        return (
          <div className="inline-flex items-center justify-center gap-2 text-[#ef4444] font-bold text-[11px] bg-red-50/50 px-3 py-1 rounded-full border border-red-100/50 min-w-[90px]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444]"></div> Suspended
          </div>
        );
      case 'INACTIVE':
        return (
          <div className="inline-flex items-center justify-center gap-2 text-slate-500 font-bold text-[11px] bg-slate-50/50 px-3 py-1 rounded-full border border-slate-200/50 min-w-[90px]">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> Inactive
          </div>
        );
      default:
        return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
    }
  };

  const filteredTenants = useMemo(() => {
    return tenants.filter(tenant =>
      tenant.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.companyCode?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tenants, searchTerm]);

  // Paginated tenants (client-side)
  const paginatedTenants = useMemo(() => {
    const start = page * size;
    return filteredTenants.slice(start, start + size);
  }, [filteredTenants, page, size]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Administration</h1>
          <div className="flex items-center text-[12px] font-bold text-slate-400 mt-1.5">
            <span className="hover:text-slate-600 cursor-pointer transition-colors">Platform</span>
            <ChevronRight size={14} className="mx-1.5 text-slate-300" />
            <span className="text-[#6366f1]">Tenants</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 bg-white border border-slate-200 px-4 py-2 rounded-full text-[12px] font-bold text-emerald-600 shadow-sm">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          System Online
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Tenants', value: stats.total, trend: stats.totalTrend, trendColor: 'text-emerald-500', icon: <Users size={22} />, iconColor: 'bg-[#6366f1]' },
          { label: 'Active', value: stats.active, trend: stats.activeTrend, trendColor: 'text-emerald-500', icon: <Check size={22} />, iconColor: 'bg-[#10b981]' },
          { label: 'Pending Approval', value: stats.pending, trend: 'Live', showTrendIcon: false, trendColor: 'text-amber-500', icon: <Clock size={22} />, iconColor: 'bg-[#f59e0b]' },
          { label: 'Suspended', value: stats.suspended, trend: stats.suspendedTrend, trendColor: stats.suspendedTrend.startsWith('+') && stats.suspendedTrend !== '0%' ? 'text-red-500' : 'text-slate-400', icon: <Ban size={22} />, iconColor: 'bg-[#ef4444]' },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden group hover:ring-primary/20 transition-all duration-300">
            <CardContent className="p-7">
              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 ${stat.iconColor} rounded-2xl flex items-center justify-center text-white shadow-xl shadow-${stat.iconColor.split('[')[1].split(']')[0]}/20 group-hover:scale-110 transition-transform`}>
                  {stat.icon}
                </div>
                <div className={`flex items-center gap-1.5 text-[12px] font-black ${stat.trendColor}`}>
                  {stat.trendIcon || (stat.trend !== 'No change' && stat.trend !== '0' && <TrendingUp size={16} />)}
                  {stat.trend}
                </div>
              </div>
              <div className="mt-6">
                <div className="text-4xl font-black text-slate-900 tracking-tighter">{stat.value}</div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mt-2">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Registration Chart Section */}
        <Card className="lg:col-span-2 border-none shadow-sm ring-1 ring-slate-200/60">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">New Registrations</CardTitle>
              <CardDescription className="text-xs font-bold text-slate-400 mt-1">Monthly tenant sign-ups over the last 6 months</CardDescription>
            </div>
            <div className="bg-[#6366f110] text-[#6366f1] px-4 py-1.5 rounded-full text-[11px] font-black border border-[#6366f120]">
              Real-time Sync
            </div>
          </CardHeader>
          <CardContent className="pt-10">
            <div className="flex items-end justify-between h-56 gap-6 px-6">
              {chartData.map((d, i) => (
                <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-5 group">
                  <div
                    className={`w-full rounded-2xl transition-all duration-1000 ${d.active ? 'bg-gradient-to-t from-[#4f46e5] to-[#6366f1] shadow-2xl shadow-[#6366f1]/40' : 'bg-[#e2e8f0] group-hover:bg-[#cbd5e1]'}`}
                    style={{ height: d.height }}
                  ></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{d.month}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution Section */}
        <Card className="border-none shadow-sm ring-1 ring-slate-200/60">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900">Status Overview</CardTitle>
            <CardDescription className="text-xs font-bold text-slate-400 mt-1">Tenant distribution by status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-4">
            {[
              { label: 'Active', value: stats.active, color: 'bg-[#10b981]' },
              { label: 'Pending', value: stats.pending, color: 'bg-[#f59e0b]' },
              { label: 'Inactive', value: stats.inactive, color: 'bg-slate-300' },
              { label: 'Suspended', value: stats.suspended, color: 'bg-[#ef4444]' },
            ].map((s, i) => (
              <div key={i} className="space-y-3">
                <div className="flex justify-between items-center text-[12px]">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${s.color}`}></div>
                    <span className="font-bold text-slate-600">{s.label}</span>
                  </div>
                  <span className="font-black text-slate-900">{s.value}</span>
                </div>
                <Progress value={stats.total > 0 ? (s.value / stats.total) * 100 : 0} className="h-2" indicatorClassName={s.color} />
              </div>
            ))}
            <div className="pt-8 mt-4 border-t border-slate-50 flex items-center justify-between">
              <div className="text-4xl font-black text-slate-900 tracking-tighter">{tenants.length}</div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">tenants loaded</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tenant Registry Table Section */}
      <Card className="border-none shadow-xl shadow-slate-200/50 ring-1 ring-slate-200/60 overflow-hidden bg-white">
        <CardHeader className="bg-white p-8 border-b border-slate-100">
          <CardTitle className="text-xl font-bold text-slate-900">Tenant Registry</CardTitle>
          <CardDescription className="text-xs font-bold text-slate-400 mt-1">All registered organizations and their current status</CardDescription>
        </CardHeader>
        <CardContent className="p-0 bg-white">
          <Table>
            <TableHeader className="bg-slate-50/60">
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 py-6 pl-10">Company</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 px-6">Code</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 px-6">Company Email</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 px-6">Status</TableHead>
                <TableHead className="text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 pr-10">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse border-slate-50">
                    <TableCell colSpan={7} className="py-12"><div className="h-6 bg-slate-50 rounded-xl mx-8"></div></TableCell>
                  </TableRow>
                ))
              ) : paginatedTenants.length > 0 ? (
                paginatedTenants.map((t, idx) => (
                  <TableRow key={t.tenantId} className="border-slate-50 hover:bg-slate-50/40 transition-all duration-300 group">
                    <TableCell className="pl-10 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-2xl ${idx % 2 === 0 ? 'bg-indigo-600' : 'bg-blue-600'} flex items-center justify-center text-white text-[14px] font-black shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform`}>
                          {t.companyName?.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-800 text-[15px]">{t.companyName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-[12px] font-black text-slate-400 bg-slate-100/60 px-3 py-1 rounded-lg">
                        {t.companyCode?.toLowerCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-[12px] text-slate-500 font-bold px-6">{t.email}</TableCell>
                    <TableCell className="px-6">{getStatusBadge(t.status)}</TableCell>
                    <TableCell className="text-right pr-10">
                      <div className="flex justify-end gap-3 transition-opacity duration-300">
                        {t.status === 'PENDING' ? (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-xl border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 shadow-sm transition-transform active:scale-95"
                            onClick={() => showConfirm(t.tenantId, t.companyName, 'approve')}
                            title="Approve Tenant"
                          >
                            <Check size={18} strokeWidth={3} />
                          </Button>
                        ) : t.status === 'ACTIVE' ? (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 rounded-xl border-slate-100 text-slate-400 hover:bg-slate-100 shadow-sm transition-transform active:scale-95"
                              onClick={() => showConfirm(t.tenantId, t.companyName, 'deactivate')}
                              title="Deactivate Tenant"
                            >
                              <Slash size={16} strokeWidth={3} />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 rounded-xl border-red-50 bg-red-50 text-red-400 hover:bg-red-100 shadow-sm transition-transform active:scale-95"
                              onClick={() => showConfirm(t.tenantId, t.companyName, 'suspend')}
                              title="Suspend Tenant"
                            >
                              <Ban size={16} strokeWidth={3} />
                            </Button>
                          </>
                        ) : t.status === 'SUSPENDED' ? (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 rounded-xl border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 shadow-sm transition-transform active:scale-95"
                              onClick={() => showConfirm(t.tenantId, t.companyName, 'activate')}
                              title="Activate Tenant"
                            >
                              <Check size={18} strokeWidth={3} />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              disabled
                              className="h-10 w-10 rounded-xl border-slate-100 text-slate-300 opacity-40 cursor-not-allowed shadow-none"
                              title="Cannot deactivate a suspended tenant (must be active first)"
                            >
                              <Slash size={16} strokeWidth={3} />
                            </Button>
                          </>
                        ) : t.status === 'INACTIVE' ? (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 rounded-xl border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 shadow-sm transition-transform active:scale-95"
                              onClick={() => showConfirm(t.tenantId, t.companyName, 'activate')}
                              title="Activate Tenant"
                            >
                              <Check size={18} strokeWidth={3} />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              disabled
                              className="h-10 w-10 rounded-xl border-red-100/50 bg-red-50/30 text-red-300 opacity-40 cursor-not-allowed shadow-none"
                              title="Cannot suspend an inactive tenant (must be active first)"
                            >
                              <Ban size={16} strokeWidth={3} />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-slate-400 text-xs font-black uppercase tracking-[0.3em]">
                    Empty Registry
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            totalPages={Math.ceil(filteredTenants.length / size)}
            totalElements={filteredTenants.length}
            size={size}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleConfirmAction}
        title={dialogDetails.title}
        description={dialogDetails.description}
        confirmText={dialogDetails.confirmText}
        cancelText="Cancel"
        variant={dialogDetails.variant}
        isLoading={approveMutation.isPending || actionMutation.isPending}
      />
    </div>
  );
};

export default TenantManagement;

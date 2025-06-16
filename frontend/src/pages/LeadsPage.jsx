import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

// MUI Components
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  IconButton,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Checkbox,
  Stack,
  Avatar,
  Divider,
  FormControlLabel,
  Switch,
  Link,
  Tooltip,
} from "@mui/material";

// MUI Icons
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  Comment as CommentIcon,
  Assignment as AssignmentIcon,
  PersonAdd as PersonAddIcon,
  FilterList as FilterIcon,
  Description as DescriptionIcon,
  FileUpload as ImportIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as InjectIcon,
} from "@mui/icons-material";

// Project Components & Services
import AddLeadForm from "../components/AddLeadForm";
import DocumentPreview from "../components/DocumentPreview";
import api from "../services/api";
import { selectUser } from "../store/slices/authSlice";
import { getSortedCountries } from "../constants/countries";
import ImportLeadsDialog from "../components/ImportLeadsDialog";
import EditLeadForm from "../components/EditLeadForm";

// --- Constants ---
const ROLES = {
  ADMIN: "admin",
  AFFILIATE_MANAGER: "affiliate_manager",
  LEAD_MANAGER: "lead_manager",
  AGENT: "agent",
};

const LEAD_STATUSES = {
  ACTIVE: "active",
  CONTACTED: "contacted",
  CONVERTED: "converted",
  INACTIVE: "inactive",
};

const LEAD_TYPES = {
  FTD: "ftd",
  FILLER: "filler",
  COLD: "cold",
  LIVE: "live",
};

// --- Validation Schemas ---
const commentSchema = yup.object({
  text: yup
    .string()
    .required("Comment is required")
    .min(3, "Comment must be at least 3 characters"),
});

const assignmentSchema = yup.object({
  agentId: yup.string().required("Agent is required"),
});

// --- Helper Functions ---
const getStatusColor = (status) => {
  switch (status) {
    case LEAD_STATUSES.ACTIVE:
    case LEAD_STATUSES.CONVERTED:
      return "success";
    case LEAD_STATUSES.CONTACTED:
      return "info";
    case LEAD_STATUSES.INACTIVE:
      return "error";
    default:
      return "default";
  }
};

const getLeadTypeColor = (leadType) => {
  if (!leadType) return "default";
  switch (leadType.toLowerCase()) {
    case LEAD_TYPES.FTD:
      return "success";
    case LEAD_TYPES.FILLER:
      return "warning";
    case LEAD_TYPES.COLD:
      return "info";
    case LEAD_TYPES.LIVE:
      return "secondary";
    default:
      return "default";
  }
};

const getDocumentStatusColor = (status) => {
  switch (status) {
    case "good":
      return "success";
    case "ok":
      return "warning";
    case "pending":
      return "error";
    default:
      return "default";
  }
};

// --- Sub-components ---

// Memoized component for lead details to avoid re-renders
const LeadDetails = React.memo(({ lead }) => (
  <Box sx={{
    animation: 'fadeIn 0.3s ease-in-out',
    '@keyframes fadeIn': {
      '0%': {
        opacity: 0,
        transform: 'translateY(-10px)',
      },
      '100%': {
        opacity: 1,
        transform: 'translateY(0)',
      },
    },
  }}>
    <Grid container spacing={3}>
      {/* Basic Information */}
      <Grid item xs={12} md={4}>
        <Paper elevation={0} sx={{
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          height: '100%',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: theme => theme.shadows[4],
            transform: 'translateY(-4px)',
          },
        }}>
          <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PersonAddIcon fontSize="small" />
            Contact Details
          </Typography>
          <Stack spacing={1}>
            {lead.newEmail && (
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span style={{ color: 'text.secondary' }}>📧</span> {lead.newEmail}
              </Typography>
            )}
            {lead.oldEmail && (
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span style={{ color: 'text.secondary' }}>📧</span> Old Email: {lead.oldEmail}
              </Typography>
            )}
            {lead.newPhone && (
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span style={{ color: 'text.secondary' }}>📱</span> {lead.newPhone}
              </Typography>
            )}
            {lead.oldPhone && (
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span style={{ color: 'text.secondary' }}>📱</span> Old Phone: {lead.oldPhone}
              </Typography>
            )}
            {lead.country && (
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span style={{ color: 'text.secondary' }}>🌍</span> {lead.country}
              </Typography>
            )}
            {lead.gender && (
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span style={{ color: 'text.secondary' }}>⚧</span> {lead.gender === 'not_defined' ? 'Not Defined' : lead.gender.charAt(0).toUpperCase() + lead.gender.slice(1)}
              </Typography>
            )}
            {lead.leadType === LEAD_TYPES.FTD && lead.sin && (
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span style={{ color: 'text.secondary' }}>🆔</span> SIN: {lead.sin}
              </Typography>
            )}
            {lead.dob && (
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span style={{ color: 'text.secondary' }}>📅</span> DOB: {new Date(lead.dob).toLocaleDateString()}
              </Typography>
            )}
            {lead.address && (
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <span style={{ color: 'text.secondary' }}>🏠</span>
                <span style={{ whiteSpace: 'pre-line' }}>{lead.address}</span>
              </Typography>
            )}
          </Stack>
        </Paper>
      </Grid>

      {/* Documents Section */}
      {lead.documents && lead.documents.length > 0 && (
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <DescriptionIcon fontSize="small" />
              Documents
            </Typography>
            <Stack spacing={2}>
              {lead.documents.map((doc, index) => (
                <Box key={index} sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  {doc?.url && doc.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <Box sx={{ mb: 1 }}>
                      <DocumentPreview
                        url={doc.url}
                        type={doc.description || `Document ${index + 1}`}
                      />
                    </Box>
                  ) : (
                    <Link
                      href={doc?.url || '#'}
                      target="_blank"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        color: 'primary.main',
                        textDecoration: 'none',
                        '&:hover': {
                          textDecoration: 'underline'
                        }
                      }}
                    >
                      <DescriptionIcon fontSize="small" />
                      {doc?.description || 'View Document'}
                    </Link>
                  )}
                  {doc?.description && doc?.url && !doc.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      {doc.description}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>
      )}

      {/* Comments Section */}
      <Grid item xs={12} md={lead.documents && lead.documents.length > 0 ? 4 : 8}>
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider', height: '100%' }}>
          <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CommentIcon fontSize="small" />
            Comments & Activity
          </Typography>
          <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
            {lead.comments && lead.comments.length > 0 ? (
              <Stack spacing={2}>
                {lead.comments.map((comment, index) => (
                  <Box key={index} sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                      {comment.author?.fullName || 'Unknown User'} • {new Date(comment.createdAt).toLocaleString()}
                    </Typography>
                    <Typography variant="body2">{comment.text}</Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                <CommentIcon sx={{ fontSize: 40, opacity: 0.5, mb: 1 }} />
                <Typography variant="body2">No comments yet</Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Grid>

      {(lead.client || lead.clientBroker || lead.clientNetwork) && (
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              Client Information
            </Typography>
            <Stack spacing={1}>
              {lead.client && <Typography variant="body2">Client: {lead.client}</Typography>}
              {lead.clientBroker && <Typography variant="body2">Broker: {lead.clientBroker}</Typography>}
              {lead.clientNetwork && <Typography variant="body2">Network: {lead.clientNetwork}</Typography>}
            </Stack>
          </Paper>
        </Grid>
      )}

      {lead.socialMedia && Object.values(lead.socialMedia).some(Boolean) && (
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              Social Media Profiles
            </Typography>
            <Stack spacing={1}>
              {lead.socialMedia.facebook && <Link href={lead.socialMedia.facebook} target="_blank" rel="noopener noreferrer" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary', textDecoration: 'none' }}><img src="/facebook-icon.svg" alt="Facebook" width={16} height={16} />Facebook</Link>}
              {lead.socialMedia.twitter && <Link href={lead.socialMedia.twitter} target="_blank" rel="noopener noreferrer" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary', textDecoration: 'none' }}><img src="/twitter-icon.svg" alt="Twitter" width={16} height={16} />Twitter</Link>}
              {lead.socialMedia.linkedin && <Link href={lead.socialMedia.linkedin} target="_blank" rel="noopener noreferrer" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary', textDecoration: 'none' }}><img src="/linkedin-icon.svg" alt="LinkedIn" width={16} height={16} />LinkedIn</Link>}
              {lead.socialMedia.instagram && <Link href={lead.socialMedia.instagram} target="_blank" rel="noopener noreferrer" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary', textDecoration: 'none' }}><img src="/instagram-icon.svg" alt="Instagram" width={16} height={16} />Instagram</Link>}
              {lead.socialMedia.telegram && <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><img src="/telegram-icon.svg" alt="Telegram" width={16} height={16} />{lead.socialMedia.telegram}</Typography>}
              {lead.socialMedia.whatsapp && <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><img src="/whatsapp-icon.svg" alt="WhatsApp" width={16} height={16} />{lead.socialMedia.whatsapp}</Typography>}
            </Stack>
          </Paper>
        </Grid>
      )}
    </Grid>
  </Box>
));

const LeadsPage = () => {
  const user = useSelector(selectUser);

  // --- State ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [leadStats, setLeadStats] = useState(null);

  // Dialog states
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addLeadDialogOpen, setAddLeadDialogOpen] = useState(false);

  // Pagination and filtering
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalLeads, setTotalLeads] = useState(0);
  const [filters, setFilters] = useState({
    search: "",
    leadType: "",
    isAssigned: "",
    country: "",
    gender: "",
    status: "",
    documentStatus: "",
    includeConverted: true,
    order: "newest",
    orderId: "",
    assignedToMe: false,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [isInjecting, setIsInjecting] = useState(false);
  const [injectionStatus, setInjectionStatus] = useState({ success: null, message: "" });

  // --- Derived State & Roles (Memoized) ---
  const isAdminOrManager = useMemo(
    () => user?.role === ROLES.ADMIN || user?.role === ROLES.AFFILIATE_MANAGER,
    [user?.role]
  );
  const isAffiliateManager = useMemo(() => user?.role === ROLES.AFFILIATE_MANAGER, [user?.role]);
  const isLeadManager = useMemo(() => user?.role === ROLES.LEAD_MANAGER, [user?.role]);
  const isAgent = useMemo(() => user?.role === ROLES.AGENT, [user?.role]);
  const canAssignLeads = useMemo(() => isAdminOrManager, [isAdminOrManager]);
  const canDeleteLeads = useMemo(() => user?.role === ROLES.ADMIN, [user?.role]);
  const canInjectLeads = useMemo(() => user?.role === ROLES.ADMIN || user?.role === ROLES.AFFILIATE_MANAGER, [user?.role]);
  const numSelected = useMemo(() => selectedLeads.size, [selectedLeads]);

  // --- Forms ---
  const {
    control: commentControl,
    handleSubmit: handleCommentSubmit,
    reset: resetComment,
    formState: { errors: commentErrors, isSubmitting: isCommentSubmitting },
  } = useForm({
    resolver: yupResolver(commentSchema),
    defaultValues: { text: "" },
  });

  const {
    control: assignControl,
    handleSubmit: handleAssignSubmit,
    reset: resetAssign,
    formState: { errors: assignErrors, isSubmitting: isAssignSubmitting },
  } = useForm({
    resolver: yupResolver(assignmentSchema),
    defaultValues: { agentId: "" },
  });

  // --- API Calls (Memoized with useCallback) ---
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        ...filters,
      });

      // For admins/managers, if isAssigned filter is empty, remove it to show all leads
      if ((isAdminOrManager || isLeadManager) && filters.isAssigned === "") {
        params.delete("isAssigned");
      }

      const endpoint = isAgent ? "/leads/assigned" : "/leads";
      const response = await api.get(`${endpoint}?${params}`);

      if (!response.data.success) {
        throw new Error(response.data.message || "Failed to fetch leads");
      }

      setLeads(response.data.data);
      setTotalLeads(response.data.pagination.totalLeads);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || "An unexpected error occurred.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters, user, isAdminOrManager, isLeadManager, isAgent]); // Dependencies are complete

  const fetchAgents = useCallback(async () => {
    try {
      const response = await api.get("/users?role=agent&isActive=true");
      setAgents(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch agents");
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await api.get('/orders');
      setOrders(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch orders');
    }
  }, []);

  const fetchLeadStats = useCallback(async () => {
    try {
      const response = await api.get('/leads/stats');
      if (response.data.success) {
        setLeadStats(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch lead stats:', err);
    }
  }, []);

  const onSubmitComment = useCallback(async (data) => {
    try {
      setError(null);
      if (isLeadManager) {
        const lead = leads.find(l => l._id === selectedLead._id);
        if (lead?.createdBy !== user.id) {
          setError("You can only comment on leads that you created.");
          return;
        }
      }
      await api.put(`/leads/${selectedLead._id}/comment`, data);
      setSuccess("Comment added successfully!");
      setCommentDialogOpen(false);
      resetComment();
      fetchLeads();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add comment.");
    }
  }, [selectedLead, fetchLeads, resetComment, isLeadManager, user?.id, leads, setSuccess, setError]);

  const onSubmitAssignment = useCallback(async (data) => {
    try {
      setError(null);
      const leadIds = Array.from(selectedLeads);
      await api.post("/leads/assign", { leadIds, agentId: data.agentId });
      setSuccess(`${leadIds.length} lead(s) assigned successfully!`);
      setAssignDialogOpen(false);
      resetAssign();
      setSelectedLeads(new Set());
      fetchLeads();
      fetchLeadStats(); // Refresh lead stats after assignment
    } catch (err) {
      setError(err.response?.data?.message || "Failed to assign leads.");
    }
  }, [selectedLeads, fetchLeads, fetchLeadStats, resetAssign, setSuccess, setError]);

  const updateLeadStatus = useCallback(async (leadId, status) => {
    try {
      setError(null);
      if (isLeadManager) {
        const lead = leads.find(l => l._id === leadId);
        if (lead?.createdBy !== user.id) {
          setError("You can only update leads that you created.");
          return;
        }
      }
      await api.put(`/leads/${leadId}/status`, { status });
      setSuccess("Lead status updated successfully!");
      fetchLeads();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update lead status.");
    }
  }, [fetchLeads, isLeadManager, user?.id, leads, setSuccess, setError]);

  const handleDeleteLead = useCallback(async (leadId) => {
    try {
      await api.delete(`/leads/${leadId}`);
      setSuccess('Lead deleted successfully');
      fetchLeads();
      fetchLeadStats(); // Refresh lead stats after deletion
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete lead');
    }
  }, [fetchLeads, fetchLeadStats, setSuccess, setError]);

  const handleInjectLead = async (leadId) => {
    setIsInjecting(true);
    setInjectionStatus({ success: null, message: "Starting injection..." });
    try {
      const landingPageUrl = `${window.location.origin}/landing`;
      const res = await api.post(`/leads/${leadId}/inject`, { landingPage: landingPageUrl });
      if (res.status === 200) {
        setInjectionStatus({ success: true, message: "Injection process started successfully!" });
      }
    } catch (error) {
      const message = error.response?.data?.message || "Failed to start injection.";
      setInjectionStatus({ success: false, message });
    } finally {
      setIsInjecting(false);
      // Hide the message after a few seconds
      setTimeout(() => setInjectionStatus({ success: null, message: "" }), 5000);
    }
  };

  // --- Effects ---
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    if (isAdminOrManager) {
      fetchAgents();
      fetchOrders();
      fetchLeadStats();
    }
  }, [isAdminOrManager, fetchAgents, fetchOrders, fetchLeadStats]);

  // Clear success message after a delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);


  // --- Handlers (Memoized) ---
  const handleLeadAdded = useCallback((lead) => {
    fetchLeads();
    fetchLeadStats(); // Refresh lead stats after adding a new lead
  }, [fetchLeads, fetchLeadStats]);

  const handleChangePage = useCallback((_, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleFilterChange = useCallback((field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      search: "", leadType: "", isAssigned: "", country: "", gender: "", status: "",
      documentStatus: "", includeConverted: true, order: "newest", orderId: "",
    });
    setPage(0);
  }, []);

  const handleSelectAll = useCallback((event) => {
    if (event.target.checked) {
      setSelectedLeads(new Set(leads.map((lead) => lead._id)));
    } else {
      setSelectedLeads(new Set());
    }
  }, [leads]);

  const handleSelectLead = useCallback((leadId) => (event) => {
    setSelectedLeads(prev => {
      const newSelected = new Set(prev);
      if (event.target.checked) {
        newSelected.add(leadId);
      } else {
        newSelected.delete(leadId);
      }
      return newSelected;
    });
  }, []);

  const toggleRowExpansion = useCallback((leadId) => {
    setExpandedRows(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(leadId)) {
        newExpanded.delete(leadId);
      } else {
        newExpanded.add(leadId);
      }
      return newExpanded;
    });
  }, []);

  const handleOpenCommentDialog = useCallback((lead) => {
    setSelectedLead(lead);
    setCommentDialogOpen(true);
  }, []);

  const handleEditLead = (lead) => {
    setSelectedLead(lead);
    setEditDialogOpen(true);
  };

  const handleLeadUpdated = (updatedLead) => {
    setSuccess("Lead updated successfully");
    fetchLeads();
  };



  // --- Render ---
  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
        sx={{
          '& .MuiButton-root': {
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: theme => theme.shadows[4],
            },
          },
        }}
      >
        <Typography
          variant="h4"
          gutterBottom
          sx={{
            position: 'relative',
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: -8,
              left: 0,
              width: '60px',
              height: '4px',
              backgroundColor: 'primary.main',
              borderRadius: '2px',
              transition: 'width 0.3s ease-in-out',
            },
            '&:hover::after': {
              width: '100%',
            },
          }}
        >
          {isAgent ? "My Assigned Leads" : "Lead Management"}
        </Typography>
        <Box display="flex" gap={2} alignItems="center">
          {(isLeadManager || user?.role === ROLES.ADMIN) && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<PersonAddIcon />}
              onClick={() => setAddLeadDialogOpen(true)}
            >
              Add New Lead
            </Button>
          )}
          {isAdminOrManager && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<ImportIcon />}
              onClick={() => setImportDialogOpen(true)}
            >
              Import
            </Button>
          )}
          {canAssignLeads && numSelected > 0 && (
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setAssignDialogOpen(true)}
            >
              Assign {numSelected} Lead{numSelected !== 1 ? "s" : ""}
            </Button>
          )}
          {canDeleteLeads && numSelected > 0 && (
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete ${numSelected} lead${numSelected !== 1 ? 's' : ''}?`)) {
                  const selectedLeadIds = Array.from(selectedLeads);
                  Promise.all(selectedLeadIds.map(id => api.delete(`/leads/${id}`)))
                    .then(() => {
                      setSuccess(`Successfully deleted ${numSelected} lead${numSelected !== 1 ? 's' : ''}`);
                      setSelectedLeads(new Set());
                      fetchLeads();
                    })
                    .catch(err => {
                      setError(err.response?.data?.message || 'Failed to delete leads');
                    });
                }
              }}
              sx={{ ml: 2 }}
            >
              Delete {numSelected} Lead{numSelected !== 1 ? "s" : ""}
            </Button>
          )}
        </Box>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {injectionStatus.message && (
        <Alert severity={injectionStatus.success === true ? "success" : (injectionStatus.success === false ? "error" : "info")} sx={{ mb: 2 }}>
          {injectionStatus.message}
        </Alert>
      )}

      {isAdminOrManager && (
        <Card sx={{
          mb: 2,
          background: 'linear-gradient(135deg, #f5f7fa 0%, #ffffff 100%)',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: theme => theme.shadows[8],
          },
        }}>
          <CardContent>
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={{
                  color: 'primary.main',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  '& .MuiSvgIcon-root': {
                    transition: 'transform 0.3s ease-in-out',
                  },
                  '&:hover .MuiSvgIcon-root': {
                    transform: 'rotate(360deg)',
                  },
                }}
              >
                <AssignmentIcon sx={{ mr: 1 }} />
                Lead Assignment Summary
              </Typography>
              <Divider />
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={6} sm={3}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    height: '100%',
                    background: 'rgba(255, 255, 255, 0.8)',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: theme => theme.shadows[4],
                      background: 'rgba(255, 255, 255, 0.95)',
                    },
                  }}
                >
                  <Typography
                    variant="h4"
                    color="primary"
                    sx={{
                      fontWeight: 'bold',
                      animation: 'countUp 1s ease-out',
                      '@keyframes countUp': {
                        '0%': {
                          opacity: 0,
                          transform: 'translateY(20px)',
                        },
                        '100%': {
                          opacity: 1,
                          transform: 'translateY(0)',
                        },
                      },
                    }}
                  >
                    {leadStats?.leads?.overall?.total || 0}
                  </Typography>
                  <Typography variant="subtitle2" color="textSecondary">Total Leads</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    height: '100%',
                    background: 'rgba(255, 255, 255, 0.8)',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: theme => theme.shadows[4],
                      background: 'rgba(255, 255, 255, 0.95)',
                    },
                  }}
                >
                  <Typography
                    variant="h4"
                    color="success.main"
                    sx={{
                      fontWeight: 'bold',
                      animation: 'countUp 1s ease-out',
                      '@keyframes countUp': {
                        '0%': {
                          opacity: 0,
                          transform: 'translateY(20px)',
                        },
                        '100%': {
                          opacity: 1,
                          transform: 'translateY(0)',
                        },
                      },
                    }}
                  >
                    {leadStats?.leads?.overall?.assigned || 0}
                  </Typography>
                  <Typography variant="subtitle2" color="textSecondary">Assigned</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    height: '100%',
                    background: 'rgba(255, 255, 255, 0.8)',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: theme => theme.shadows[4],
                      background: 'rgba(255, 255, 255, 0.95)',
                    },
                  }}
                >
                  <Typography
                    variant="h4"
                    color="warning.main"
                    sx={{
                      fontWeight: 'bold',
                      animation: 'countUp 1s ease-out',
                      '@keyframes countUp': {
                        '0%': {
                          opacity: 0,
                          transform: 'translateY(20px)',
                        },
                        '100%': {
                          opacity: 1,
                          transform: 'translateY(0)',
                        },
                      },
                    }}
                  >
                    {leadStats?.leads?.overall?.available || 0}
                  </Typography>
                  <Typography variant="subtitle2" color="textSecondary">Unassigned</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    height: '100%',
                    background: 'rgba(255, 255, 255, 0.8)',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: theme => theme.shadows[4],
                      background: 'rgba(255, 255, 255, 0.95)',
                    },
                  }}
                >
                  <Typography
                    variant="h4"
                    color="info.main"
                    sx={{
                      fontWeight: 'bold',
                      animation: 'countUp 1s ease-out',
                      '@keyframes countUp': {
                        '0%': {
                          opacity: 0,
                          transform: 'translateY(20px)',
                        },
                        '100%': {
                          opacity: 1,
                          transform: 'translateY(0)',
                        },
                      },
                    }}
                  >
                    {leadStats?.leads?.overall?.total > 0
                      ? Math.round((leadStats.leads.overall.assigned / leadStats.leads.overall.total) * 100)
                      : 0}%
                  </Typography>
                  <Typography variant="subtitle2" color="textSecondary">Assignment Rate</Typography>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* --- Filters --- */}
      <Box sx={{ mb: 2 }}>
        <Button
          startIcon={<FilterIcon />}
          onClick={() => setShowFilters(!showFilters)}
          sx={{
            mb: 2,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-2px)',
            },
            '& .MuiSvgIcon-root': {
              transition: 'transform 0.3s ease-in-out',
            },
            '&:hover .MuiSvgIcon-root': {
              transform: 'rotate(180deg)',
            },
          }}
        >
          {showFilters ? "Hide Filters" : "Show Filters"}
        </Button>
        <Collapse in={showFilters}>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6} md={3}><TextField fullWidth label="Search" value={filters.search} onChange={(e) => handleFilterChange("search", e.target.value)} placeholder="Name, email, phone..." InputProps={{ startAdornment: (<SearchIcon sx={{ mr: 1, color: "action.active" }} />) }} /></Grid>
            <Grid item xs={12} sm={6} md={2}><FormControl fullWidth><InputLabel>Lead Type</InputLabel><Select value={filters.leadType} label="Lead Type" onChange={(e) => handleFilterChange("leadType", e.target.value)}><MenuItem value="">All</MenuItem>{Object.values(LEAD_TYPES).map(type => <MenuItem key={type} value={type}>{type.toUpperCase()}</MenuItem>)}</Select></FormControl></Grid>
            {isAdminOrManager && <Grid item xs={12} sm={6} md={2}><FormControl fullWidth><InputLabel>Assignment</InputLabel><Select value={filters.isAssigned} label="Assignment" onChange={(e) => handleFilterChange("isAssigned", e.target.value)}><MenuItem value="">All</MenuItem><MenuItem value="true">Assigned</MenuItem><MenuItem value="false">Unassigned</MenuItem></Select></FormControl></Grid>}
            {isAffiliateManager && <Grid item xs={12} sm={6} md={2}><FormControlLabel control={<Switch checked={filters.assignedToMe} onChange={(e) => handleFilterChange("assignedToMe", e.target.checked)} color="primary" />} label="My Assigned Leads" /></Grid>}
            <Grid item xs={12} sm={6} md={2}><FormControl fullWidth><InputLabel>Status</InputLabel><Select value={filters.status} label="Status" onChange={(e) => handleFilterChange("status", e.target.value)}><MenuItem value="">All</MenuItem>{Object.values(LEAD_STATUSES).map(status => <MenuItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</MenuItem>)}</Select></FormControl></Grid>
            {isAdminOrManager && <Grid item xs={12} sm={6} md={2}><FormControlLabel control={<Switch checked={filters.includeConverted} onChange={(e) => handleFilterChange("includeConverted", e.target.checked)} color="primary" />} label="Show Converted" /></Grid>}
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth>
                <InputLabel>Country</InputLabel>
                <Select
                  value={filters.country}
                  label="Country"
                  onChange={(e) => handleFilterChange("country", e.target.value)}
                >
                  <MenuItem value="">All Countries</MenuItem>
                  {getSortedCountries().map((country) => (
                    <MenuItem key={country.code} value={country.name}>
                      {country.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}><FormControl fullWidth><InputLabel>Gender</InputLabel><Select value={filters.gender} label="Gender" onChange={(e) => handleFilterChange("gender", e.target.value)}><MenuItem value="">All</MenuItem><MenuItem value="male">Male</MenuItem><MenuItem value="female">Female</MenuItem><MenuItem value="not_defined">Not Defined</MenuItem></Select></FormControl></Grid>
            {isAdminOrManager && <Grid item xs={12} sm={6} md={2}><FormControl fullWidth><InputLabel>Order Filter</InputLabel><Select value={filters.orderId} label="Order Filter" onChange={(e) => handleFilterChange("orderId", e.target.value)}><MenuItem value="">All Orders</MenuItem>{orders.map(order => <MenuItem key={order._id} value={order._id}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Chip label={`#${order._id.slice(-6)}`} size="small" color={order.status === 'fulfilled' ? 'success' : 'default'} /><Typography variant="body2">{`${Object.values(order.fulfilled).reduce((a, b) => a + b, 0)} leads - ${new Date(order.createdAt).toLocaleDateString()}`}</Typography></Box></MenuItem>)}</Select></FormControl></Grid>}
            <Grid item xs={12} sm={6} md={2}><FormControl fullWidth><InputLabel>Order By</InputLabel><Select value={filters.order} label="Order By" onChange={(e) => handleFilterChange("order", e.target.value)}><MenuItem value="newest">Newest First</MenuItem><MenuItem value="oldest">Oldest First</MenuItem><MenuItem value="name_asc">Name (A-Z)</MenuItem><MenuItem value="name_desc">Name (Z-A)</MenuItem></Select></FormControl></Grid>
            <Grid item xs={12}><Button onClick={clearFilters} variant="outlined">Clear Filters</Button></Grid>
          </Grid>
        </Collapse>
      </Box>

      {/* --- Leads Table (Desktop) --- */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <Paper>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 180px)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {canAssignLeads && <TableCell padding="checkbox" sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)', backgroundColor: 'background.paper', fontSize: '0.875rem' }}><Checkbox indeterminate={numSelected > 0 && numSelected < leads.length} checked={leads.length > 0 && numSelected === leads.length} onChange={handleSelectAll} /></TableCell>}
                  <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)', backgroundColor: 'background.paper', fontSize: '0.875rem', py: 1 }}>Name</TableCell>
                  <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)', backgroundColor: 'background.paper', fontSize: '0.875rem', py: 1 }}>Type</TableCell>
                  <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)', backgroundColor: 'background.paper', fontSize: '0.875rem', py: 1 }}>Contact</TableCell>
                  <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)', backgroundColor: 'background.paper', fontSize: '0.875rem', py: 1 }}>Country</TableCell>
                  <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)', backgroundColor: 'background.paper', fontSize: '0.875rem', py: 1 }}>Gender</TableCell>
                  <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)', backgroundColor: 'background.paper', fontSize: '0.875rem', py: 1 }}>Client Info</TableCell>
                  {isAdminOrManager && <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)', backgroundColor: 'background.paper', fontSize: '0.875rem', py: 1 }}>Assigned To</TableCell>}
                  <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)', backgroundColor: 'background.paper', fontSize: '0.875rem', py: 1 }}>Status</TableCell>
                  <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)', backgroundColor: 'background.paper', fontSize: '0.875rem', py: 1 }}>Order</TableCell>
                  <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)', backgroundColor: 'background.paper', fontSize: '0.875rem', py: 1 }}>Created</TableCell>
                  <TableCell sx={{ backgroundColor: 'background.paper', fontSize: '0.875rem', py: 1 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={isAdminOrManager ? 12 : 11} align="center"><CircularProgress /></TableCell></TableRow>
                  : leads.length === 0 ? <TableRow><TableCell colSpan={isAdminOrManager ? 12 : 11} align="center">No leads found</TableCell></TableRow>
                    : leads.map(lead => (
                      <React.Fragment key={lead._id}>
                        <LeadRow
                          lead={lead}
                          canAssignLeads={canAssignLeads}
                          canDeleteLeads={canDeleteLeads}
                          canInjectLeads={canInjectLeads}
                          isInjecting={isInjecting}
                          onInjectLead={handleInjectLead}
                          isAdminOrManager={isAdminOrManager}
                          isLeadManager={isLeadManager}
                          userId={user?.id}
                          user={user}
                          selectedLeads={selectedLeads}
                          expandedRows={expandedRows}
                          onSelectLead={handleSelectLead}
                          onUpdateStatus={updateLeadStatus}
                          onComment={handleOpenCommentDialog}
                          onToggleExpansion={toggleRowExpansion}
                          onFilterByOrder={(orderId) => handleFilterChange("orderId", orderId)}
                          onDeleteLead={handleDeleteLead}
                          handleEditLead={handleEditLead}
                        />
                        {expandedRows.has(lead._id) && (
                          <TableRow>
                            <TableCell colSpan={isAdminOrManager ? 12 : 11} sx={{ bgcolor: 'background.default', borderBottom: '2px solid', borderColor: 'divider', py: 3 }}>
                              <LeadDetails lead={lead} />
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination rowsPerPageOptions={[5, 10, 25]} component="div" count={totalLeads} rowsPerPage={rowsPerPage} page={page} onPageChange={handleChangePage} onRowsPerPageChange={handleChangeRowsPerPage} />
        </Paper>
      </Box>

      {/* --- Leads Cards (Mobile/Tablet) --- */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {loading ? <Box display="flex" justifyContent="center" p={3}><CircularProgress /></Box>
          : leads.length === 0 ? <Paper sx={{ p: 3, textAlign: 'center' }}><Typography color="text.secondary">No leads found</Typography></Paper>
            : (
              <Stack spacing={2}>
                {leads.map(lead => (
                  <LeadCard
                    key={lead._id}
                    lead={lead}
                    canAssignLeads={canAssignLeads}
                    canDeleteLeads={canDeleteLeads}
                    canInjectLeads={canInjectLeads}
                    isInjecting={isInjecting}
                    onInjectLead={handleInjectLead}
                    selectedLeads={selectedLeads}
                    expandedRows={expandedRows}
                    onSelectLead={handleSelectLead}
                    onUpdateStatus={updateLeadStatus}
                    onComment={handleOpenCommentDialog}
                    onToggleExpansion={toggleRowExpansion}
                    onDeleteLead={handleDeleteLead}
                    user={user}
                    isLeadManager={isLeadManager}
                    handleEditLead={handleEditLead}
                  />
                ))}
                <TablePagination rowsPerPageOptions={[5, 10, 25]} component="div" count={totalLeads} rowsPerPage={rowsPerPage} page={page} onPageChange={handleChangePage} onRowsPerPageChange={handleChangeRowsPerPage} />
              </Stack>
            )}
      </Box>

      {/* --- Dialogs --- */}
      <Dialog open={commentDialogOpen} onClose={() => setCommentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Comment</DialogTitle>
        <form onSubmit={handleCommentSubmit(onSubmitComment)}>
          <DialogContent>
            {selectedLead && <Box mb={2}><Typography variant="subtitle2">Lead: {selectedLead.firstName} {selectedLead.lastName}</Typography><Typography variant="caption" color="textSecondary">{selectedLead.email} • {selectedLead.leadType.toUpperCase()}</Typography></Box>}
            <Controller name="text" control={commentControl} render={({ field }) => (<TextField {...field} fullWidth label="Comment" multiline rows={4} error={!!commentErrors.text} helperText={commentErrors.text?.message} placeholder="Add your comment about this lead..." />)} />
          </DialogContent>
          <DialogActions><Button onClick={() => setCommentDialogOpen(false)}>Cancel</Button><Button type="submit" variant="contained" disabled={isCommentSubmitting}>{isCommentSubmitting ? <CircularProgress size={24} /> : "Add Comment"}</Button></DialogActions>
        </form>
      </Dialog>
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Leads to Agent</DialogTitle>
        <form onSubmit={handleAssignSubmit(onSubmitAssignment)}>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2 }}>Assigning {numSelected} lead{numSelected !== 1 ? "s" : ""} to an agent:</Typography>
            <Controller name="agentId" control={assignControl} render={({ field }) => (<FormControl fullWidth error={!!assignErrors.agentId}><InputLabel>Select Agent</InputLabel><Select {...field} label="Select Agent">{agents.map(agent => (<MenuItem key={agent._id} value={agent._id}><Box display="flex" alignItems="center"><Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: "0.75rem" }}>{agent.fourDigitCode || agent.fullName[0]}</Avatar>{agent.fullName} ({agent.fourDigitCode})</Box></MenuItem>))}</Select>{assignErrors.agentId && <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>{assignErrors.agentId.message}</Typography>}</FormControl>)} />
          </DialogContent>
          <DialogActions><Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button><Button type="submit" variant="contained" disabled={isAssignSubmitting}>{isAssignSubmitting ? <CircularProgress size={24} /> : "Assign Leads"}</Button></DialogActions>
        </form>
      </Dialog>

      {/* Add ImportLeadsDialog */}
      <ImportLeadsDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImportComplete={fetchLeads}
      />

      <EditLeadForm
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedLead(null);
        }}
        lead={selectedLead}
        onLeadUpdated={handleLeadUpdated}
        sx={{
          '& .MuiBackdrop-root': {
            backdropFilter: 'blur(5px)',
          }
        }}
      />

      <Dialog
        open={addLeadDialogOpen}
        onClose={() => setAddLeadDialogOpen(false)}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiBackdrop-root': {
            backdropFilter: 'blur(5px)',
          }
        }}
      >
        <DialogTitle>Add New Lead</DialogTitle>
        <DialogContent>
          <AddLeadForm
            onLeadAdded={(lead) => {
              handleLeadAdded(lead);
              setAddLeadDialogOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

// --- Memoized Row Component for Desktop Table ---
const LeadRow = React.memo(({ lead, canAssignLeads, canDeleteLeads, canInjectLeads, isInjecting, onInjectLead, isAdminOrManager, isLeadManager, userId, selectedLeads, expandedRows, onSelectLead, onUpdateStatus, onComment, onToggleExpansion, onFilterByOrder, onDeleteLead, user, handleEditLead }) => {
  const isOwner = !isLeadManager || lead.createdBy === userId;

  const handleRowClick = (event) => {
    if (event.target.closest('button, input, select, [role="combobox"], .MuiSelect-select, .MuiMenuItem-root')) {
      return;
    }
    onToggleExpansion(lead._id);
  };

  const cellSx = {
    borderRight: '1px solid rgba(224, 224, 224, 1)',
    py: 0.5,
    fontSize: '0.875rem'
  };

  return (
    <TableRow
      hover
      onClick={handleRowClick}
      sx={{
        '&:hover': { backgroundColor: 'action.hover' },
        borderLeft: theme => `4px solid ${theme.palette[getLeadTypeColor(lead.leadType)]?.main || theme.palette.grey.main}`,
        cursor: 'pointer'
      }}
    >
      {canAssignLeads && <TableCell padding="checkbox" sx={cellSx}><Checkbox checked={selectedLeads.has(lead._id)} onChange={onSelectLead(lead._id)} /></TableCell>}
      <TableCell sx={cellSx}><Stack direction="row" spacing={1} alignItems="center"><Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: theme => theme.palette[getLeadTypeColor(lead.leadType)]?.light, color: theme => theme.palette[getLeadTypeColor(lead.leadType)]?.main }}>{(lead.fullName || `${lead.firstName} ${lead.lastName || ""}`.trim()).charAt(0).toUpperCase()}</Avatar><Box><Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}>{lead.fullName || `${lead.firstName} ${lead.lastName || ""}`.trim()}</Typography><Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>ID: {lead._id.slice(-8)}</Typography></Box></Stack></TableCell>
      <TableCell sx={cellSx}><Chip label={(lead.leadType || 'unknown').toUpperCase()} color={getLeadTypeColor(lead.leadType)} size="small" sx={{ fontWeight: 'medium', height: '20px', '& .MuiChip-label': { fontSize: '0.75rem', px: 1 } }} /></TableCell>
      <TableCell sx={cellSx}><Stack spacing={0.5}><Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.875rem' }}>📧 {lead.newEmail}</Typography><Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.875rem' }}>📱 {lead.newPhone || 'N/A'}</Typography></Stack></TableCell>
      <TableCell sx={cellSx}><Chip label={lead.country || 'Unknown'} size="small" variant="outlined" sx={{ height: '20px', '& .MuiChip-label': { fontSize: '0.75rem', px: 1 } }} /></TableCell>
      <TableCell sx={cellSx}>{lead.gender || 'N/A'}</TableCell>
      <TableCell sx={cellSx}>{lead.clientInfo || 'N/A'}</TableCell>
      {isAdminOrManager && <TableCell sx={cellSx}>{lead.assignedTo ? lead.assignedTo.fullName : 'Unassigned'}</TableCell>}
      <TableCell sx={cellSx}><Chip label={lead.status.charAt(0).toUpperCase() + lead.status.slice(1)} color={getStatusColor(lead.status)} size="small" sx={{ height: '20px', '& .MuiChip-label': { fontSize: '0.75rem', px: 1 } }} /></TableCell>
      <TableCell sx={cellSx}>{lead.orderId ? <Link component="button" onClick={(e) => { e.stopPropagation(); onFilterByOrder(typeof lead.orderId === 'object' ? lead.orderId._id : lead.orderId); }} sx={{ fontSize: '0.875rem' }}>{(typeof lead.orderId === 'object' ? lead.orderId._id : lead.orderId).slice(-8)}</Link> : 'N/A'}</TableCell>
      <TableCell sx={cellSx}>{new Date(lead.createdAt).toLocaleDateString()}</TableCell>
      <TableCell sx={{ py: 0.5 }}>
        <Stack direction="row" spacing={0.5}>
          <FormControl size="small" sx={{ minWidth: 100 }}><Select value={lead.status} onChange={(e) => onUpdateStatus(lead._id, e.target.value)} size="small" disabled={!isOwner} sx={{ '& .MuiSelect-select': { py: 0.5, fontSize: '0.875rem' } }}>{Object.values(LEAD_STATUSES).map(status => <MenuItem key={status} value={status} sx={{ fontSize: '0.875rem' }}>{status.charAt(0).toUpperCase() + status.slice(1)}</MenuItem>)}</Select></FormControl>
          <IconButton size="small" onClick={() => onComment(lead)} disabled={!isOwner}><CommentIcon sx={{ fontSize: '1.25rem' }} /></IconButton>
          {(user?.role === ROLES.ADMIN || (isLeadManager && lead.createdBy === user?.id)) && (
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleEditLead(lead); }} title="Edit Lead">
              <EditIcon sx={{ fontSize: '1.25rem' }} />
            </IconButton>
          )}
          {canDeleteLeads && (
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); if (window.confirm('Are you sure you want to delete this lead?')) { onDeleteLead(lead._id); } }} color="error">
              <DeleteIcon sx={{ fontSize: '1.25rem' }} />
            </IconButton>
          )}
          {canInjectLeads && (
            <Tooltip title="Inject Lead">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onInjectLead(lead._id); }} disabled={isInjecting}>
                <InjectIcon sx={{ fontSize: '1.25rem' }} />
              </IconButton>
            </Tooltip>
          )}
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggleExpansion(lead._id); }}>
            {expandedRows.has(lead._id) ? <ExpandLessIcon sx={{ fontSize: '1.25rem' }} /> : <ExpandMoreIcon sx={{ fontSize: '1.25rem' }} />}
          </IconButton>
        </Stack>
      </TableCell>
    </TableRow>
  )
});

// --- Memoized Card Component for Mobile View ---
const LeadCard = React.memo(({ lead, canAssignLeads, canDeleteLeads, canInjectLeads, isInjecting, onInjectLead, selectedLeads, expandedRows, onSelectLead, onUpdateStatus, onComment, onToggleExpansion, onDeleteLead, user, isLeadManager, handleEditLead }) => {
  const handleCardClick = (event) => {
    if (event.target.closest('button, input, select, [role="combobox"], .MuiSelect-select, .MuiMenuItem-root')) {
      return;
    }
    onToggleExpansion(lead._id);
  };

  return (
    <Paper
      onClick={handleCardClick}
      sx={{
        p: 2,
        borderLeft: theme => `4px solid ${theme.palette[getLeadTypeColor(lead.leadType)]?.main || theme.palette.grey.main}`,
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          backgroundColor: 'action.hover',
          transform: 'translateX(4px)',
          boxShadow: theme => theme.shadows[4],
        },
        '& .MuiChip-root': {
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'scale(1.05)',
          },
        },
        '& .MuiIconButton-root': {
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'scale(1.1)',
            backgroundColor: 'action.hover',
          },
        },
      }}
    >
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: theme => theme.palette[getLeadTypeColor(lead.leadType)]?.light, color: theme => theme.palette[getLeadTypeColor(lead.leadType)]?.main }}>{(lead.fullName || `${lead.firstName} ${lead.lastName || ""}`.trim()).charAt(0).toUpperCase()}</Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">{lead.fullName || `${lead.firstName} ${lead.lastName || ""}`.trim()}</Typography>
                <Typography variant="caption" color="text.secondary">ID: {lead._id.slice(-8)}</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label={(lead.leadType || 'unknown').toUpperCase()} color={getLeadTypeColor(lead.leadType)} size="small" />
              <Chip label={lead.status.charAt(0).toUpperCase() + lead.status.slice(1)} color={getStatusColor(lead.status)} size="small" />
            </Stack>
          </Stack>
        </Grid>
        <Grid item xs={12}><Divider /></Grid>
        <Grid item xs={12}><FormControl size="small" fullWidth><InputLabel>Status</InputLabel><Select value={lead.status} label="Status" onChange={(e) => onUpdateStatus(lead._id, e.target.value)} size="small">{Object.values(LEAD_STATUSES).map(status => <MenuItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</MenuItem>)}</Select></FormControl></Grid>
        <Grid item xs={12}>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpansion(lead._id);
              }}
              sx={{ transform: expandedRows.has(lead._id) ? 'rotate(180deg)' : 'none' }}
            >
              <ExpandMoreIcon />
            </IconButton>
            <IconButton size="small" onClick={() => onComment(lead)} sx={{ color: 'info.main' }}><CommentIcon /></IconButton>
            {(user?.role === ROLES.ADMIN || (isLeadManager && lead.createdBy === user?.id)) && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditLead(lead);
                }}
                title="Edit Lead"
              >
                <EditIcon />
              </IconButton>
            )}
            {canDeleteLeads && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Are you sure you want to delete this lead?')) {
                    onDeleteLead(lead._id);
                  }
                }}
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            )}
            {canInjectLeads && (
              <Tooltip title="Inject Lead">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onInjectLead(lead._id); }} disabled={isInjecting}>
                  <InjectIcon />
                </IconButton>
              </Tooltip>
            )}
            {canAssignLeads && <Checkbox checked={selectedLeads.has(lead._id)} onChange={onSelectLead(lead._id)} size="small" />}
          </Stack>
        </Grid>
        <Collapse in={expandedRows.has(lead._id)} sx={{ width: '100%' }}>
          <Grid item xs={12}>
            <Box sx={{ mt: 2, pb: 2, overflowX: 'hidden' }}>
              <LeadDetails lead={lead} />
            </Box>
          </Grid>
        </Collapse>
      </Grid>
    </Paper>
  )
});



export default LeadsPage;
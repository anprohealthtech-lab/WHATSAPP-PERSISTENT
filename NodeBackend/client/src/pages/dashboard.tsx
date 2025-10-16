import { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  MessageSquare, 
  Send, 
  AlertTriangle, 
  RefreshCw,
  CheckCircle,
  XCircle,
  FileUp, 
  History, 
  Settings, 
  Gauge, 
  FileText, 
  Bell,
  User,
  Phone,
  Calendar,
  Filter,
  Search,
  Eye,
  RotateCcw,
  QrCode
} from 'lucide-react';
import { whatsAppService, type WhatsAppStatus } from '../services/whatsappService';

const Dashboard = () => {
  const [whatsAppStatus, setWhatsAppStatus] = useState<WhatsAppStatus>({
    connected: false
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messageStats, setMessageStats] = useState({
    today: 0,
    total: 0,
    failed: 0,
    pending: 0
  });

  useEffect(() => {
    fetchWhatsAppStatus();
    // Poll status every 5 seconds
    const interval = setInterval(fetchWhatsAppStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchWhatsAppStatus = async () => {
    try {
      const status = await whatsAppService.getStatus();
      setWhatsAppStatus(status);
      if (status.connected) {
        setShowQRCode(false);
        setQrCodeUrl(null);
      }
      setError(null);
    } catch (error) {
      console.error('Failed to fetch WhatsApp status:', error);
      setError('Failed to check WhatsApp status');
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    setShowQRCode(false);

    try {
      const connectResult = await whatsAppService.connect();
      
      if (connectResult.success) {
        await fetchWhatsAppStatus();
        setError(null);
      } else {
        // Try to get QR code
        const qrResult = await whatsAppService.getQRCode();
        if (qrResult.success && qrResult.qrCode) {
          setQrCodeUrl(qrResult.qrCode);
          setShowQRCode(true);
        } else {
          throw new Error(connectResult.error || qrResult.error || 'Connection failed');
        }
      }
    } catch (error) {
      console.error('Connection error:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect to WhatsApp');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const result = await whatsAppService.disconnect();
      if (result.success) {
        await fetchWhatsAppStatus();
        setShowQRCode(false);
        setQrCodeUrl(null);
      } else {
        setError(result.error || 'Failed to disconnect');
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      setError('Failed to disconnect from WhatsApp');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">WhatsApp LIMS Integration System</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
            whatsAppStatus.connected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {whatsAppStatus.connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {whatsAppStatus.connected ? 'Connected' : 'Disconnected'}
          </div>
          <button
            onClick={fetchWhatsAppStatus}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-red-800">Connection Error</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 text-xs mt-2 hover:text-red-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* WhatsApp Status Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-lg ${
              whatsAppStatus.connected ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {whatsAppStatus.connected ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">WhatsApp Status</p>
              <p className={`text-xl font-bold ${
                whatsAppStatus.connected ? 'text-green-600' : 'text-red-600'
              }`}>
                {whatsAppStatus.connected ? 'Connected' : 'Disconnected'}
              </p>
              {whatsAppStatus.phoneNumber && (
                <p className="text-xs text-gray-500">{whatsAppStatus.phoneNumber}</p>
              )}
              {!whatsAppStatus.connected && (
                <p className="text-xs text-red-500">• Never connected</p>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            {whatsAppStatus.connected ? (
              <button
                onClick={handleDisconnect}
                className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4" />
                    Connect WhatsApp
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Messages Today */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Send className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Messages Today</p>
              <p className="text-2xl font-bold text-gray-900">{messageStats.today}</p>
              <p className="text-xs text-green-600">+{messageStats.today} delivered</p>
            </div>
          </div>
        </div>

        {/* Total Messages */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <MessageSquare className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Messages</p>
              <p className="text-2xl font-bold text-gray-900">{messageStats.total}</p>
              <p className="text-xs text-gray-500">{messageStats.pending} pending</p>
            </div>
          </div>
        </div>

        {/* Failed Messages */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Failed Messages</p>
              <p className="text-2xl font-bold text-red-600">{messageStats.failed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Send Message Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Send Message</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="+1234567890"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message
              </label>
              <textarea
                rows={4}
                placeholder="Type your message here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              disabled={!whatsAppStatus.connected}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Send Message
            </button>
          </div>
        </div>

        {/* Message History Preview */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Message History</h2>
            <select className="text-sm border border-gray-300 rounded px-2 py-1">
              <option>All Status</option>
              <option>Sent</option>
              <option>Failed</option>
              <option>Pending</option>
            </select>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded text-sm">
              <span className="font-medium">Timestamp</span>
              <span className="font-medium">Recipient</span>
              <span className="font-medium">Status</span>
            </div>
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No messages found</p>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRCode && qrCodeUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-4">Scan QR Code with WhatsApp</h3>
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-white border border-gray-200 rounded-lg">
                  <img 
                    src={qrCodeUrl} 
                    alt="WhatsApp QR Code"
                    className="w-48 h-48"
                  />
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-600 mb-6">
                <p className="font-medium">Steps to connect:</p>
                <ol className="text-left space-y-1 max-w-xs mx-auto">
                  <li>1. Open WhatsApp on your phone</li>
                  <li>2. Tap Menu (⋮) → Linked Devices</li>
                  <li>3. Tap "Link a Device"</li>
                  <li>4. Scan this QR code</li>
                </ol>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowQRCode(false);
                    setQrCodeUrl(null);
                  }}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConnect}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Refresh QR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

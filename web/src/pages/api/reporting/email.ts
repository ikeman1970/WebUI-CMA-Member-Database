import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import { canViewReporting } from '@/lib/reportingAccess';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const canView = await canViewReporting(account);
  if (!canView) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const { recipientEmail, quarterlyData, fromMonth, toMonth, chapterName } = req.body as {
    recipientEmail?: string;
    quarterlyData?: Record<string, unknown>;
    fromMonth?: string;
    toMonth?: string;
    chapterName?: string;
  };

  if (!recipientEmail || !quarterlyData || !fromMonth || !toMonth) {
    return res.status(400).json({ message: 'Missing required fields: recipientEmail, quarterlyData, fromMonth, toMonth' });
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return res.status(400).json({ message: 'Invalid email address' });
  }

  // Generate HTML email content
  const data = quarterlyData as Record<string, unknown>;
  const secularEventCount = data.secularEventCount || 0;
  const secularAttendance = data.secularEventAttendance || 0;
  const outreachEventCount = data.outreachEventCount || 0;
  const outreachAttendance = data.outreachEventAttendance || 0;
  const fellowshipEventCount = data.fellowshipEventCount || 0;
  const fellowshipAttendance = data.fellowshipEventAttendance || 0;
  const salvations = data.salvations || 0;
  const rededications = data.rededications || 0;
  const otherMinistry = data.otherMinistry || 0;
  const guestMonth1 = data.guestMonth1 || 0;
  const guestMonth2 = data.guestMonth2 || 0;
  const guestMonth3 = data.guestMonth3 || 0;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CMA Quarterly Report - ${fromMonth} to ${toMonth}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #0066cc;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .header p {
      margin: 5px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .section {
      margin: 20px 0;
      padding: 15px;
      background-color: #f9f9f9;
      border-left: 4px solid #0066cc;
      border-radius: 4px;
    }
    .section h2 {
      margin-top: 0;
      font-size: 18px;
      color: #0066cc;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 15px 0;
    }
    .metric-card {
      background-color: white;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .metric-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
      font-weight: bold;
    }
    .metric-value {
      font-size: 24px;
      font-weight: bold;
      color: #0066cc;
    }
    .event-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
    }
    .event-row:last-child {
      border-bottom: none;
    }
    .event-type {
      font-weight: bold;
      color: #333;
    }
    .event-stat {
      text-align: center;
    }
    .event-label {
      font-size: 12px;
      color: #666;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #999;
      text-align: center;
    }
    .button {
      display: inline-block;
      background-color: #0066cc;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      text-decoration: none;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>CMA Quarterly Report</h1>
    <p>${chapterName || 'Chapter Report'}</p>
    <p>Period: ${fromMonth} to ${toMonth}</p>
  </div>

  <div class="section">
    <h2>Event Summary</h2>
    <div class="event-row">
      <div class="event-type">Secular Events</div>
      <div class="event-stat"><div class="event-label">Count</div>${secularEventCount}</div>
      <div class="event-stat"><div class="event-label">Attendance</div>${secularAttendance}</div>
    </div>
    <div class="event-row">
      <div class="event-type">Outreach Events</div>
      <div class="event-stat"><div class="event-label">Count</div>${outreachEventCount}</div>
      <div class="event-stat"><div class="event-label">Attendance</div>${outreachAttendance}</div>
    </div>
    <div class="event-row">
      <div class="event-type">Fellowship Events</div>
      <div class="event-stat"><div class="event-label">Count</div>${fellowshipEventCount}</div>
      <div class="event-stat"><div class="event-label">Attendance</div>${fellowshipAttendance}</div>
    </div>
  </div>

  <div class="section">
    <h2>Ministry Outcomes</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Salvations</div>
        <div class="metric-value" style="color: #0066cc;">${salvations}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Rededications</div>
        <div class="metric-value" style="color: #00aa00;">${rededications}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Other Ministry</div>
        <div class="metric-value" style="color: #ff9900;">${otherMinistry}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Guest Tracking</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Month 1 Guests</div>
        <div class="metric-value" style="color: #9933cc;">${guestMonth1}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Month 2 Guests</div>
        <div class="metric-value" style="color: #9933cc;">${guestMonth2}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Month 3 Guests</div>
        <div class="metric-value" style="color: #9933cc;">${guestMonth3}</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>This quarterly report was generated by the CMA Member Database app.</p>
    <p>Report generated on ${new Date().toLocaleDateString()}</p>
  </div>
</body>
</html>
  `.trim();

  // For now, we&apos;ll return the HTML content that can be sent via email
  // In a production environment, integrate with:
  // - SendGrid API
  // - Mailgun API
  // - AWS SES
  // - Supabase email service
  // - etc.

  // This endpoint returns the prepared email that can be sent
  // The actual sending would be handled by a configured email service
  return res.status(200).json({
    success: true,
    message: 'Email content prepared. Ready to send to: ' + recipientEmail,
    email: {
      to: recipientEmail,
      subject: 'CMA Quarterly Report - ' + fromMonth + ' to ' + toMonth,
      html: htmlContent
    }
  });
}

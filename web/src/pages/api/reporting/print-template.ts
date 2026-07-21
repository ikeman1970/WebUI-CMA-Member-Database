import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import { canViewReporting } from '@/lib/reportingAccess';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
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

  const chapterId = typeof req.query.chapterId === 'string' ? req.query.chapterId : '';
  const chapterName = typeof req.query.chapterName === 'string' ? req.query.chapterName : 'CMA Chapter';
  const month = typeof req.query.month === 'string' ? req.query.month : new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  // Generate HTML for printable sign-in sheet
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CMA Sign-In Sheet - ${chapterName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      color: #333;
    }
    
    .page {
      page-break-after: always;
      margin-bottom: 40px;
    }
    
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
    }
    
    .header h1 {
      font-size: 24px;
      margin-bottom: 5px;
    }
    
    .header p {
      font-size: 12px;
      color: #666;
    }
    
    .month-label {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 10px;
      text-align: right;
    }
    
    .instructions {
      font-size: 11px;
      margin-bottom: 15px;
      padding: 10px;
      background-color: #f9f9f9;
      border-left: 3px solid #0066cc;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    
    th, td {
      border: 1px solid #999;
      padding: 6px;
      text-align: left;
    }
    
    th {
      background-color: #0066cc;
      color: white;
      font-weight: bold;
      height: 40px;
    }
    
    td {
      height: 20px;
    }
    
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    
    .event-column {
      text-align: center;
      width: 60px;
    }
    
    .name-column {
      width: 150px;
    }
    
    .member-column {
      width: 80px;
      text-align: center;
    }
    
    .section-header {
      font-weight: bold;
      background-color: #e6e6e6;
      text-align: center;
    }
    
    .footer {
      margin-top: 20px;
      font-size: 10px;
      color: #999;
      text-align: center;
    }
    
    .event-legend {
      font-size: 10px;
      margin-top: 10px;
      padding: 10px;
      background-color: #f0f0f0;
      border-radius: 4px;
    }
    
    .event-legend strong {
      display: block;
      margin-bottom: 5px;
    }
    
    .event-legend p {
      margin: 2px 0;
    }
    
    @media print {
      body { padding: 0; }
      .page { margin-bottom: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>Christian Motorcyclists Association</h1>
      <p>Chapter Sign-In Sheet</p>
      <p>${chapterName}</p>
    </div>
    
    <div class="month-label">Month: ________________  Year: ________________</div>
    
    <div class="instructions">
      <strong>Instructions:</strong> Write attendee names and member numbers. For each event attended, mark with ✔ or write number of times attended. Mark outcome metrics (Salvations, Rededications, Other Ministry) in the rightmost columns.
    </div>
    
    <table>
      <thead>
        <tr>
          <th class="name-column">Attendee Name</th>
          <th class="member-column">Member #</th>
          <th colspan="12" class="section-header" style="text-align: center;">Events Attended</th>
          <th class="section-header" style="width: 60px; text-align: center;">Salvations</th>
          <th class="section-header" style="width: 70px; text-align: center;">Rededications</th>
          <th class="section-header" style="width: 70px; text-align: center;">Other Ministry</th>
          <th class="section-header" style="width: 60px; text-align: center;">Guests</th>
        </tr>
        <tr>
          <th colspan="2"></th>
          <th class="event-column">Event 1</th>
          <th class="event-column">Event 2</th>
          <th class="event-column">Event 3</th>
          <th class="event-column">Event 4</th>
          <th class="event-column">Event 5</th>
          <th class="event-column">Event 6</th>
          <th class="event-column">Event 7</th>
          <th class="event-column">Event 8</th>
          <th class="event-column">Event 9</th>
          <th class="event-column">Event 10</th>
          <th class="event-column">Event 11</th>
          <th class="event-column">Event 12</th>
          <th style="text-align: center;">✓</th>
          <th style="text-align: center;">✓</th>
          <th style="text-align: center;">✓</th>
          <th style="text-align: center;">✓</th>
        </tr>
      </thead>
      <tbody>
        ${Array.from({ length: 20 })
          .map(
            () => 
              '<tr>' +
              '<td class="name-column"></td>' +
              '<td class="member-column"></td>' +
              '<td class="event-column"></td>' +
              '<td class="event-column"></td>' +
              '<td class="event-column"></td>' +
              '<td class="event-column"></td>' +
              '<td class="event-column"></td>' +
              '<td class="event-column"></td>' +
              '<td class="event-column"></td>' +
              '<td class="event-column"></td>' +
              '<td class="event-column"></td>' +
              '<td class="event-column"></td>' +
              '<td class="event-column"></td>' +
              '<td class="event-column"></td>' +
              '<td></td>' +
              '<td></td>' +
              '<td></td>' +
              '<td></td>' +
              '</tr>'
          )
          .join('')}
      </tbody>
    </table>
    
    <div class="event-legend">
      <strong>Legend:</strong>
      <p><strong>Events:</strong> Mark with ✔ for attendance or number for multiple events. Event types: Secular, Outreach, Fellowship</p>
      <p><strong>Outcomes:</strong> Count total for the month (can be same person multiple times)</p>
      <p><strong>Guests:</strong> Count of non-members attending</p>
    </div>
    
    <div class="footer">
      <p>Instructions: Once completed, import this sheet via the CMA Member Database app to update quarterly metrics.</p>
      <p>Print date: ${new Date().toLocaleDateString()}</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const filename = 'CMA-SignIn-' + chapterName.replace(/\s+/g, '_') + '.html';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
  return res.status(200).send(html);
}

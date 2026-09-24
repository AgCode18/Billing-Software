const escapeHtml = (value = "") => {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const money = (value) => {
  return Number(value || 0).toFixed(2);
};

export const generateInvoiceHtml = ({ invoice, business }) => {
  const items = invoice.items || [];

  const itemRows = items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>

          <td>
            ${escapeHtml(item.productName)}
            ${
              item.sku
                ? `<div class="muted">SKU: ${escapeHtml(item.sku)}</div>`
                : ""
            }
          </td>

          <td>${escapeHtml(item.unit)}</td>

          <td class="right">
            ${money(item.quantity)}
          </td>

          <td class="right">
            ₹${money(item.unitPrice)}
          </td>

          <td class="right">
            ${money(item.taxRate)}%
          </td>

          <td class="right">
            ₹${money(item.taxAmount)}
          </td>

          <td class="right">
            ₹${money(item.totalAmount)}
          </td>
        </tr>
      `,
    )
    .join("");

  const paymentRows = invoice.payments?.length
    ? invoice.payments
        .map(
          (payment) => `
              <tr>
                <td>
                  ${new Date(payment.paymentDate).toLocaleDateString("en-IN")}
                </td>

                <td>
                  ${escapeHtml(payment.paymentMethod)}
                </td>

                <td>
                  ${escapeHtml(payment.referenceNo || "-")}
                </td>

                <td class="right">
                  ₹${money(payment.amount)}
                </td>

                <td>
                  ${escapeHtml(payment.status || "COMPLETED")}
                </td>
              </tr>
            `,
        )
        .join("")
    : `
          <tr>
            <td colspan="5" class="center">
              No payments recorded
            </td>
          </tr>
        `;

  const businessLogo = business.logo
    ? `
      <img
        src="${escapeHtml(business.logo)}"
        class="business-logo"
        alt="Business Logo"
      />
    `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>
    ${escapeHtml(invoice.invoiceNumber)}
  </title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 30px;
      font-family:
        Arial,
        Helvetica,
        sans-serif;
      color: #111;
      background: #fff;
      font-size: 13px;
    }

    .invoice {
      max-width: 1000px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      gap: 30px;
      border-bottom: 2px solid #111;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }

    .business-section {
      display: flex;
      gap: 15px;
    }

    .business-logo {
      width: 80px;
      height: 80px;
      object-fit: contain;
    }

    .business-name {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .invoice-title {
      text-align: right;
    }

    .invoice-title h1 {
      margin: 0;
      font-size: 30px;
    }

    .invoice-number {
      margin-top: 8px;
      font-size: 14px;
      font-weight: bold;
    }

    .section {
      margin-bottom: 25px;
    }

    .two-column {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
    }

    .section-title {
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 8px;
      color: #555;
    }

    .customer-name {
      font-size: 17px;
      font-weight: bold;
      margin-bottom: 5px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      background: #f2f2f2;
      font-weight: bold;
    }

    th,
    td {
      border: 1px solid #ccc;
      padding: 8px;
      vertical-align: top;
    }

    .right {
      text-align: right;
    }

    .center {
      text-align: center;
    }

    .muted {
      color: #777;
      font-size: 11px;
      margin-top: 3px;
    }

    .summary-wrapper {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
    }

    .summary {
      width: 350px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 7px 0;
      border-bottom: 1px solid #ddd;
    }

    .summary-row.total {
      font-size: 17px;
      font-weight: bold;
      border-bottom: 2px solid #111;
      padding-top: 12px;
    }

    .summary-row.due {
      font-size: 16px;
      font-weight: bold;
    }

    .status {
      display: inline-block;
      padding: 5px 10px;
      border: 1px solid #111;
      font-weight: bold;
      font-size: 11px;
    }

    .notes {
      border: 1px solid #ddd;
      padding: 12px;
      margin-top: 20px;
    }

    .footer {
      margin-top: 40px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #666;
      font-size: 11px;
    }

    @media print {
      body {
        padding: 0;
      }

      .invoice {
        max-width: none;
      }

      @page {
        size: A4;
        margin: 12mm;
      }
    }
  </style>
</head>

<body>
  <div class="invoice">

    <!-- HEADER -->

    <div class="header">

      <div class="business-section">

        ${businessLogo}

        <div>
          <div class="business-name">
            ${escapeHtml(business.name)}
          </div>

          ${
            business.ownerName
              ? `<div>
                  Owner:
                  ${escapeHtml(business.ownerName)}
                </div>`
              : ""
          }

          ${
            business.address
              ? `<div>
                  ${escapeHtml(business.address)}
                </div>`
              : ""
          }

          ${
            business.city || business.state || business.pincode
              ? `<div>
                  ${escapeHtml(
                    [business.city, business.state, business.pincode]
                      .filter(Boolean)
                      .join(", "),
                  )}
                </div>`
              : ""
          }

          ${
            business.phone
              ? `<div>
                  Phone:
                  ${escapeHtml(business.phone)}
                </div>`
              : ""
          }

          ${
            business.email
              ? `<div>
                  Email:
                  ${escapeHtml(business.email)}
                </div>`
              : ""
          }

          ${
            business.gstNumber
              ? `<div>
                  GSTIN:
                  ${escapeHtml(business.gstNumber)}
                </div>`
              : ""
          }

          ${
            business.panNumber
              ? `<div>
                  PAN:
                  ${escapeHtml(business.panNumber)}
                </div>`
              : ""
          }
        </div>
      </div>

      <div class="invoice-title">

        <h1>INVOICE</h1>

        <div class="invoice-number">
          ${escapeHtml(invoice.invoiceNumber)}
        </div>

        <div>
          Date:
          ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}
        </div>

        ${
          invoice.dueDate
            ? `<div>
                Due:
                ${new Date(invoice.dueDate).toLocaleDateString("en-IN")}
              </div>`
            : ""
        }

        <br />

        <span class="status">
          ${escapeHtml(invoice.status)}
        </span>

      </div>
    </div>

    <!-- CUSTOMER -->

    <div class="section">

      <div class="two-column">

        <div>
          <div class="section-title">
            Bill To
          </div>

          <div class="customer-name">
            ${escapeHtml(invoice.customerName)}
          </div>

          ${
            invoice.customerAddress
              ? `<div>
                  ${escapeHtml(invoice.customerAddress)}
                </div>`
              : ""
          }

          ${
            invoice.customerPhone
              ? `<div>
                  Phone:
                  ${escapeHtml(invoice.customerPhone)}
                </div>`
              : ""
          }

          ${
            invoice.customerEmail
              ? `<div>
                  Email:
                  ${escapeHtml(invoice.customerEmail)}
                </div>`
              : ""
          }

          ${
            invoice.customerGst
              ? `<div>
                  GSTIN:
                  ${escapeHtml(invoice.customerGst)}
                </div>`
              : ""
          }
        </div>

        <div>
          <div class="section-title">
            Payment Status
          </div>

          <div>
            ${escapeHtml(invoice.paymentStatus)}
          </div>
        </div>

      </div>
    </div>

    <!-- ITEMS -->

    <div class="section">

      <table>

        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>Unit</th>
            <th class="right">
              Qty
            </th>
            <th class="right">
              Price
            </th>
            <th class="right">
              Tax
            </th>
            <th class="right">
              Tax Amount
            </th>
            <th class="right">
              Total
            </th>
          </tr>
        </thead>

        <tbody>
          ${itemRows}
        </tbody>

      </table>

    </div>

    <!-- SUMMARY -->

    <div class="summary-wrapper">

      <div class="summary">

        <div class="summary-row">
          <span>Subtotal</span>
          <span>
            ₹${money(invoice.subtotal)}
          </span>
        </div>

        <div class="summary-row">
          <span>Discount</span>
          <span>
            ₹${money(invoice.discountAmount)}
          </span>
        </div>

        <div class="summary-row">
          <span>Tax</span>
          <span>
            ₹${money(invoice.taxAmount)}
          </span>
        </div>

        <div class="summary-row total">
          <span>Total</span>
          <span>
            ₹${money(invoice.totalAmount)}
          </span>
        </div>

        <div class="summary-row">
          <span>Paid</span>
          <span>
            ₹${money(invoice.paidAmount)}
          </span>
        </div>

        <div class="summary-row due">
          <span>Due</span>
          <span>
            ₹${money(invoice.dueAmount)}
          </span>
        </div>

      </div>

    </div>

    <!-- PAYMENTS -->

    <div class="section">

      <div class="section-title">
        Payment History
      </div>

      <table>

        <thead>
          <tr>
            <th>Date</th>
            <th>Method</th>
            <th>Reference</th>
            <th class="right">
              Amount
            </th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          ${paymentRows}
        </tbody>

      </table>

    </div>

    ${
      invoice.notes
        ? `
          <div class="notes">
            <strong>Notes</strong>
            <br />
            ${escapeHtml(invoice.notes)}
          </div>
        `
        : ""
    }

    <div class="footer">
      Thank you for your business.
    </div>

  </div>
</body>
</html>`;
};

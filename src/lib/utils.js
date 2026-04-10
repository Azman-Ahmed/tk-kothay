import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Consistently format a Date object as YYYY-MM-DD in local time.
 * Avoids the 1-day offset bug caused by toISOString() in positive timezones.
 */
export function formatLocalDate(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Basic CSV Export Helper
 * @param {Array<Object>} data - Array of objects to export
 * @param {string} filename - Desired filename (without .csv)
 */
export function exportToCSV(data, filename = "export") {
  if (!data?.length) return;
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map(obj => {
    return Object.values(obj)
      .map(val => {
        const str = String(val ?? "").replace(/"/g, '""');
        return str.includes(",") ? `"${str}"` : str;
      })
      .join(",");
  });
  const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Dynamically computes the expected DPS installments
 * and matches them against actual payments.
 */
export function generateDPSSchedule(goal, payments = []) {
  if (!goal.is_recurring || !goal.start_date || !goal.duration_months) return [];

  const installments = [];
  const start = new Date(goal.start_date);
  const amount = Number(goal.monthly_amount || 0);
  const frequency = goal.frequency || "monthly";
  const duration = parseInt(goal.duration_months);

  const paymentsMap = {};
  payments.forEach(p => {
    if(p.due_date) paymentsMap[p.due_date] = p;
  });

  const todayStr = formatLocalDate(new Date());

  if (frequency === "monthly") {
    for (let i = 0; i < duration; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
      const dateStr = formatLocalDate(d);
      
      const p = paymentsMap[dateStr];
      const isPaid = !!p;
      let status = "pending";
      if (isPaid) status = "paid";
      else if (dateStr < todayStr) status = "missed";
      
      installments.push({
        due_date: dateStr,
        amount: amount,
        status,
        paid_at: p?.paid_at || null,
        id: p?.id || null, // payment id if exists
      });
    }
  } else if (frequency === "weekly") {
     const mature = goal.mature_date ? new Date(goal.mature_date) : new Date(start.getFullYear(), start.getMonth() + duration, start.getDate());
     const matureStr = formatLocalDate(mature);
     
     let currentD = new Date(start);
     let dStr = formatLocalDate(currentD);
     while (dStr <= matureStr) {
        const p = paymentsMap[dStr];
        const isPaid = !!p;
        let status = "pending";
        if (isPaid) status = "paid";
        else if (dStr < todayStr) status = "missed";
        
        installments.push({
          due_date: dStr,
          amount: amount,
          status,
          paid_at: p?.paid_at || null,
          id: p?.id || null,
        });

        currentD.setDate(currentD.getDate() + 7);
        // Avoid timezone drift side effects by using local hours
        currentD.setHours(12, 0, 0, 0); 
        dStr = formatLocalDate(currentD);
     }
  }

  return installments;
}


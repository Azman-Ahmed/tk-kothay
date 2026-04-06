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



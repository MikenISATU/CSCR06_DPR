'use client'
import "colors";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from './supbase';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';

export const dynamic = "force-dynamic";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type User = { id: string; username: string; role: string };
type Report = {
  id: string;
  useriud: string;
  type_of_record: string;
  period_covered: string;
  no_of_pages: number;
  role: string;
  created_at: string;
};
type Category = { id: number; role: string; category: string };
type UserAccount = { id: string; username: string; role: string; name?: string; office?: string; office_head?: string; email_address?: string };
type PendingRegistration = {
  id: string;
  name: string;
  office: string;
  office_head: string;
  email_address: string;
  role: string;
  username: string;
  password: string;
  created_at: string;
};


export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [viewReport, setViewReport] = useState<Report | null>(null);
  const [yearlyReports, setYearlyReports] = useState<Report[]>([]);
  const [showYearlyModal, setShowYearlyModal] = useState(false);
  const [isReportGenerated, setIsReportGenerated] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [activeSlider, setActiveSlider] = useState<"users" | "admin" | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [newUsername, setNewUsername] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [showUserPassword, setShowUserPassword] = useState<boolean>(false);
  const [adminNewUsername, setAdminNewUsername] = useState<string>("");
  const [adminNewPassword, setAdminNewPassword] = useState<string>("");
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false);
  const [showMonthlySummary, setShowMonthlySummary] = useState(false);
  const [summaryMonth, setSummaryMonth] = useState<string>("");
  const [summaryYear, setSummaryYear] = useState<string>("");
  const [summaryRole, setSummaryRole] = useState<string>("");
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);

  const currentYear = new Date().getFullYear().toString();

  useEffect(() => {
    const stored = localStorage.getItem("scanflow360_user");
    if (!stored) return router.replace("/");
    const parsedUser = JSON.parse(stored);
    setUser(parsedUser);
    if (parsedUser.role !== "ADMIN") {
      toast.error("Access denied: Admins only");
      router.replace("/");
    }
  }, [router]);

  useEffect(() => {
    if (user && user.role === "ADMIN") {
      fetchReports();
      fetchCategories();
      fetchUsers();
      fetchPendingRegistrations();
    }
  }, [user]);

  async function fetchUsers() {
    const { data, error } = await supabase
    .from("users2")
    .select("id, username, role, name, office, office_head, email_address");

    if (error) {
      toast.error("Error fetching users: " + error.message);
      return;
    }

    setUsers(data || []);
  }

  async function fetchReports() {
    const { data, error } = await supabase
      .from("monthly_reports1")
      .select(`
        id,
        type_of_record,
        period_covered,
        no_of_pages,
        created_at,
        users2 (
          id,
          role
        )
      `);

    if (error) {
      toast.error("Error retrieving reports: " + error.message);
      return;
    }

    const formattedReports = data?.map((report: any) => ({
      id: report.id,
      useriud: report.users2?.id || "",
      type_of_record: report.type_of_record,
      period_covered: report.period_covered,
      no_of_pages: report.no_of_pages,
      created_at: report.created_at,
      role: report.users2?.role || "Unknown",
    })) || [];

    setReports(formattedReports);
  }

  async function fetchCategories() {
    const { data, error } = await supabase
      .from("record_categories")
      .select("id, role, category");

    if (error) {
      toast.error("Error retrieving categories: " + error.message);
      return;
    }

    setCategories(data || []);
  }

  async function fetchPendingRegistrations() {
    const { data, error } = await supabase
      .from("registration_pending")
      .select("*");

    if (error) {
      toast.error("Error retrieving pending registrations: " + error.message);
      return;
    }

    setPendingRegistrations(data || []);
  }

  async function addCategory() {
    if (!newCategory || !selectedRole) {
      toast.error("Please enter a category name and select a role.");
      return;
    }

    const { error } = await supabase
      .from("record_categories")
      .insert({ role: selectedRole, category: newCategory });

    if (error) {
      toast.error("Error adding category: " + error.message);
      return;
    }

    toast.success("Category added successfully!");
    setNewCategory("");
    setSelectedRole("");
    fetchCategories();
  }

  async function updateCategory(categoryId: number, updatedCategory: string) {
    if (!updatedCategory) {
      toast.error("Please enter a category name.");
      return;
    }

    const { error } = await supabase
      .from("record_categories")
      .update({ category: updatedCategory })
      .eq("id", categoryId);

    if (error) {
      toast.error("Error updating category: " + error.message);
      return;
    }

    toast.success("Category updated successfully!");
    setEditingCategory(null);
    fetchCategories();
  }

  async function deleteCategory(categoryId: number) {
    const { error } = await supabase
      .from("record_categories")
      .delete()
      .eq("id", categoryId);

    if (error) {
      toast.error("Error deleting category: " + error.message);
      return;
    }

    toast.success("Category deleted successfully!");
    fetchCategories();
  }

  async function deleteUser(userId: string) {
    const userToDelete = users.find((u) => u.id === userId);
    if (userToDelete?.role === "ADMIN") {
      toast.error("Cannot delete an admin user.");
      setShowDeleteModal(false);
      setUserToDelete(null);
      return;
    }

    const { error: reportError } = await supabase
      .from("monthly_reports1")
      .delete()
      .eq("useriud", userId);

    if (reportError) {
      toast.error("Error deleting user reports: " + reportError.message);
      setShowDeleteModal(false);
      setUserToDelete(null);
      return;
    }

    const { error } = await supabase
      .from("users2")
      .delete()
      .eq("id", userId);

    if (error) {
      toast.error("Error deleting user: " + error.message);
      setShowDeleteModal(false);
      setUserToDelete(null);
      return;
    }

    toast.success("User deleted successfully!");
    setSelectedUser(null);
    setNewUsername("");
    setNewPassword("");
    setShowDeleteModal(false);
    setUserToDelete(null);
    fetchUsers();
    fetchReports();
  }

  async function fetchYearlyReports() {
    const { data, error } = await supabase
      .from("monthly_reports1")
      .select("id, useriud, type_of_record, period_covered, no_of_pages, created_at, users2(role)")
      .gte("created_at", `${currentYear}-01-01T00:00:00Z`)
      .lte("created_at", `${currentYear}-12-31T23:59:59Z`);

    if (error) {
      toast.error("Error retrieving yearly reports: " + error.message);
      return;
    }

    const formattedReports = data?.map((report: any) => ({
      id: report.id,
      useriud: report.useriud,
      type_of_record: report.type_of_record,
      period_covered: report.period_covered,
      no_of_pages: report.no_of_pages,
      created_at: report.created_at,
      role: report.users2?.role || "Unknown",
    })) || [];

    setYearlyReports(formattedReports);
    setShowYearlyModal(true);
    setIsReportGenerated(true);
  }

  async function deleteOldReports() {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { error } = await supabase
      .from("monthly_reports1")
      .delete()
      .lt("created_at", oneYearAgo.toISOString());

    if (error) {
      toast.error("Failed to delete old reports: " + error.message);
      return;
    }

    toast.success("Records older than 1 year have been deleted successfully!");
    await fetchReports();
    if (showYearlyModal) {
      await fetchYearlyReports();
    }
  }

  async function approveRegistration(pendingId: string) {
    const registration = pendingRegistrations.find((r) => r.id === pendingId);
    if (!registration) return;

    const { error: insertError } = await supabase
      .from("users2")
      .insert({
        username: registration.username,
        role: registration.role,
        password: registration.password,
        name: registration.name,
        office: registration.office,
        office_head: registration.office_head,
        email_address: registration.email_address,
      });

    if (insertError) {
      toast.error("Error approving registration: " + insertError.message);
      return;
    }

    const { error: deleteError } = await supabase
      .from("registration_pending")
      .delete()
      .eq("id", pendingId);

    if (deleteError) {
      toast.error("Error removing pending registration: " + deleteError.message);
      return;
    }

    toast.success("Registration approved successfully!");
    fetchPendingRegistrations();
    fetchUsers();
    fetchReports();
    fetchCategories();
  }

  async function rejectRegistration(pendingId: string) {
    const { error } = await supabase
      .from("registration_pending")
      .delete()
      .eq("id", pendingId);

    if (error) {
      toast.error("Error rejecting registration: " + error.message);
      return;
    }

    toast.success("Registration rejected successfully!");
    fetchPendingRegistrations();
  }

  async function updateUserCredentials() {
    if (!selectedUser || !newUsername || !newPassword) {
      toast.error("Please select a user and provide both username and password.");
      return;
    }

    const { error } = await supabase
      .from("users2")
      .update({ username: newUsername, password: newPassword })
      .eq("id", selectedUser.id);

    if (error) {
      toast.error("Error updating user credentials: " + error.message);
      return;
    }

    toast.success("User credentials updated successfully!");
    setNewUsername("");
    setNewPassword("");
    setSelectedUser(null);
    setShowUserPassword(false);
    fetchUsers();
  }

  async function updateAdminCredentials() {
    if (!adminNewUsername || !adminNewPassword) {
      toast.error("Please provide both username and password.");
      return;
    }

    const { error } = await supabase
      .from("users2")
      .update({ username: adminNewUsername, password: adminNewPassword })
      .eq("id", user!.id);

    if (error) {
      toast.error("Error updating admin credentials: " + error.message);
      return;
    }

    toast.success("Admin credentials updated successfully!");
    localStorage.setItem(
      "scanflow360_user",
      JSON.stringify({ ...user, username: adminNewUsername })
    );
    setUser({ ...user!, username: adminNewUsername });
    setAdminNewUsername("");
    setAdminNewPassword("");
    setShowAdminPassword(false);
    fetchUsers();
  }

  function logout() {
    localStorage.removeItem("scanflow360_user");
    router.replace("/");
  }

  function applyStyles(
    worksheet: XLSX.WorkSheet,
    startRow: number,
    endRow: number,
    numCols: number,
    isHeader: boolean = false,
    centerText: boolean = false
  ) {
    for (let row = startRow; row <= endRow; row++) {
      for (let col = 0; col < numCols; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellRef]) continue;
        worksheet[cellRef].s = {
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          },
          alignment: {
            horizontal: centerText ? "center" : "left",
            vertical: "center",
          },
          font: isHeader ? { bold: true } : undefined,
        };
      }
    }
  }

  function downloadYearlyReport() {
    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([]);

    XLSX.utils.sheet_add_aoa(worksheet, [["Civil Service Commission Regional Office VI"]], {
      origin: "B1",
    });
    XLSX.utils.sheet_add_aoa(worksheet, [["DIGITIZATION OF RECORDS"]], { origin: "B2" });
    XLSX.utils.sheet_add_aoa(worksheet, [[`For the Year ${currentYear}`]], { origin: "B3" });
    XLSX.utils.sheet_add_aoa(worksheet, [["Target: 100% of Identified Records"]], { origin: "B4" });

    worksheet["!merges"] = [
      { s: { r: 0, c: 1 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 3 } },
      { s: { r: 3, c: 1 }, e: { r: 3, c: 3 } },
    ];

    applyStyles(worksheet, 0, 3, 4, true, true);

    let currentRow: number = 6;
    let totalPagesOverall: number = 0;

    const tableHeader: string[] = ["No.", "Type of Record", "Period Covered", "No. of Pages", "Role"];
    XLSX.utils.sheet_add_aoa(worksheet, [tableHeader], { origin: "A" + currentRow });
    applyStyles(worksheet, currentRow - 1, currentRow - 1, tableHeader.length, true);

    currentRow++;

    let reportIndex: number = 1;
    const allReports = yearlyReports.filter((r) => r.role !== "ADMIN");

    allReports.forEach((report) => {
      const periods = report.period_covered
        ? report.period_covered.split(",").map((p) => p.trim())
        : [""];
      const noOfPages =
        report.no_of_pages !== null && report.no_of_pages !== undefined
          ? report.no_of_pages
          : "N/A";

      if (periods.length > 1) {
        const mainRow = [reportIndex++, report.type_of_record, "", "", report.role];
        XLSX.utils.sheet_add_aoa(worksheet, [mainRow], { origin: "A" + currentRow });
        currentRow++;

        periods.forEach((period, idx) => {
          const pages = idx === 0 ? noOfPages : "";
          const subRow = ["", "", period, pages, ""];
          XLSX.utils.sheet_add_aoa(worksheet, [subRow], { origin: "A" + currentRow });
          currentRow++;
        });
      } else {
        const singleRow = [reportIndex++, report.type_of_record, periods[0], noOfPages, report.role];
        XLSX.utils.sheet_add_aoa(worksheet, [singleRow], { origin: "A" + currentRow });
        currentRow++;
      }

      if (noOfPages !== "N/A") {
        totalPagesOverall += Number(noOfPages) || 0;
      }
    });

    applyStyles(worksheet, 6, currentRow - 1, tableHeader.length);

    const totalRow = ["", "TOTAL NO. OF PAGES", "", totalPagesOverall, ""];
    XLSX.utils.sheet_add_aoa(worksheet, [totalRow], { origin: "A" + currentRow });
    applyStyles(worksheet, currentRow - 1, currentRow - 1, tableHeader.length, true);
    currentRow += 2;

    XLSX.utils.sheet_add_aoa(worksheet, [["Consolidated by:"]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [[""]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [["MARIA THERESA J. AGUIRRE"]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [["Chief HRS, PALD"]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [["Digitization Project Head"]], { origin: "A" + currentRow });
    currentRow += 2;
    XLSX.utils.sheet_add_aoa(worksheet, [["Noted by:"]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [["ATTY. ERNA T. ELIZAN"]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [["Acting Director III"]], { origin: "A" + currentRow });

    worksheet["!cols"] = [{ wch: 5 }, { wch: 50 }, { wch: 30 }, { wch: 15 }, { wch: 20 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Year_${currentYear}_Report`);
    XLSX.writeFile(workbook, `Year_${currentYear}_Report.xlsx`);
  }

  function downloadMonthlyReport() {
    if (!selectedMonth || !selectedYear) {
      toast.error("Please select both a month and a year to download the report.");
      return;
    }

    const year = selectedYear;
    const month = selectedMonth;
    const monthName = new Date(`${year}-${month}-01`).toLocaleString("default", { month: "long" });
    const filteredReports = reports.filter((r) => {
      const reportDate = new Date(r.created_at);
      return (
        reportDate.getFullYear() === parseInt(year) &&
        reportDate.getMonth() + 1 === parseInt(month) &&
        r.role !== "ADMIN"
      );
    });

    if (filteredReports.length === 0) {
      toast.error(`No reports exist for ${monthName} ${year}.`);
      return;
    }

    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([]);

    XLSX.utils.sheet_add_aoa(worksheet, [["Civil Service Commission Regional Office VI"]], {
      origin: "B1",
    });
    XLSX.utils.sheet_add_aoa(worksheet, [["DIGITIZATION OF RECORDS"]], { origin: "B2" });
    XLSX.utils.sheet_add_aoa(worksheet, [[`For the month of ${monthName} ${year}`]], { origin: "B3" });
    XLSX.utils.sheet_add_aoa(worksheet, [["Target: 100% of Identified Records"]], { origin: "B4" });

    worksheet["!merges"] = [
      { s: { r: 0, c: 1 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 3 } },
      { s: { r: 3, c: 1 }, e: { r: 3, c: 3 } },
    ];

    applyStyles(worksheet, 0, 3, 4, true, true);

    let currentRow: number = 6;
    const tableHeader: string[] = ["No.", "Type of Record", "Period Covered", "No. of Pages", "Role"];
    XLSX.utils.sheet_add_aoa(worksheet, [tableHeader], { origin: "A" + currentRow });
    applyStyles(worksheet, currentRow - 1, currentRow - 1, tableHeader.length, true);

    currentRow++;

    let reportIndex: number = 1;
    let totalPages: number = 0;

    filteredReports.forEach((report) => {
      const periods = report.period_covered
        ? report.period_covered.split(",").map((p) => p.trim())
        : [""];
      const noOfPages =
        report.no_of_pages !== null && report.no_of_pages !== undefined
          ? report.no_of_pages
          : "N/A";

      if (periods.length > 1) {
        const mainRow = [reportIndex++, report.type_of_record, "", "", report.role];
        XLSX.utils.sheet_add_aoa(worksheet, [mainRow], { origin: "A" + currentRow });
        currentRow++;

        periods.forEach((period, idx) => {
          const pages = idx === 0 ? noOfPages : "";
          const subRow = ["", "", period, pages, ""];
          XLSX.utils.sheet_add_aoa(worksheet, [subRow], { origin: "A" + currentRow });
          currentRow++;
        });
      } else {
        const singleRow = [reportIndex++, report.type_of_record, periods[0], noOfPages, report.role];
        XLSX.utils.sheet_add_aoa(worksheet, [singleRow], { origin: "A" + currentRow });
        currentRow++;
      }

      if (noOfPages !== "N/A") {
        totalPages += Number(noOfPages) || 0;
      }
    });

    applyStyles(worksheet, 6, currentRow - 1, tableHeader.length);

    const totalRow = ["", "TOTAL NO. OF PAGES", "", totalPages, ""];
    XLSX.utils.sheet_add_aoa(worksheet, [totalRow], { origin: "A" + currentRow });
    applyStyles(worksheet, currentRow - 1, currentRow - 1, tableHeader.length, true);
    currentRow += 2;

    XLSX.utils.sheet_add_aoa(worksheet, [["Consolidated by:"]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [[""]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [["MARIA THERESA J. AGUIRRE"]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [["Chief HRS, PALD"]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [["Digitization Project Head"]], { origin: "A" + currentRow });
    currentRow += 2;
    XLSX.utils.sheet_add_aoa(worksheet, [["Noted by:"]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [["ATTY. ERNA T. ELIZAN"]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [["Acting Director III"]], { origin: "A" + currentRow });

    worksheet["!cols"] = [{ wch: 5 }, { wch: 50 }, { wch: 30 }, { wch: 15 }, { wch: 20 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${monthName}_${year}_Report`);
    XLSX.writeFile(workbook, `${monthName}_${year}_Report.xlsx`);
  }

  function generateRoleReport(periodType: "monthly" | "yearly", role: string) {
    if (periodType === "monthly" && (!summaryMonth || !summaryYear)) {
      toast.error("Please select both a month and a year for the monthly report.");
      return;
    }

    const year = periodType === "monthly" ? parseInt(summaryYear) : parseInt(currentYear);
    const month = periodType === "monthly" ? parseInt(summaryMonth) : null;
    const monthName =
      periodType === "monthly"
        ? new Date(`${year}-${summaryMonth}-01`).toLocaleString("default", { month: "long" })
        : "";
    const reportTitle =
      periodType === "monthly"
        ? `For the month of ${monthName} ${year}`
        : `For the Year ${year}`;
    const periodName =
      periodType === "monthly"
        ? `${monthName}_${year}_${role}`
        : `Year_${year}_${role}`;

    const filteredReports = reports.filter((r) => {
      const reportDate = new Date(r.created_at);
      const matchesRole = r.role.toUpperCase() === role.toUpperCase();
      if (periodType === "monthly") {
        return matchesRole && reportDate.getFullYear() === year && reportDate.getMonth() + 1 === month;
      } else {
        return matchesRole && reportDate.getFullYear() === year;
      }
    });

    if (filteredReports.length === 0) {
      toast.error(`No reports found for ${role} in ${reportTitle}.`);
      return;
    }

    const groupedReports: { [key: string]: { periods: { period: string; pages: number }[] } } = {};
    filteredReports.forEach((report) => {
      const key = report.type_of_record;
      const period = report.period_covered;
      if (!groupedReports[key]) {
        groupedReports[key] = { periods: [] };
      }
      groupedReports[key].periods.push({ period, pages: report.no_of_pages });
    });

    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.sheet_add_aoa(worksheet, [[`Civil Service Commission Regional Office VI - ${role.toUpperCase()}`]], {
      origin: "B1",
    });
    XLSX.utils.sheet_add_aoa(worksheet, [["DIGITIZATION OF RECORDS"]], { origin: "B2" });
    XLSX.utils.sheet_add_aoa(worksheet, [[reportTitle]], { origin: "B3" });
    XLSX.utils.sheet_add_aoa(worksheet, [["Target: 100% of Identified Records"]], { origin: "B4" });

    worksheet["!merges"] = [
      { s: { r: 0, c: 1 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 3 } },
      { s: { r: 3, c: 1 }, e: { r: 3, c: 3 } },
    ];

    applyStyles(worksheet, 0, 3, 4, true, true);

    let currentRow: number = 6;
    const tableHeader: string[] = ["No.", "Type of Record", "Period Covered", "No. of Pages"];
    XLSX.utils.sheet_add_aoa(worksheet, [tableHeader], { origin: "A" + currentRow });
    applyStyles(worksheet, currentRow - 1, currentRow - 1, tableHeader.length, true);

    currentRow++;

    let reportIndex: number = 1;
    let totalPages: number = 0;

    Object.entries(groupedReports).forEach(([type, { periods }]) => {
      if (periods.length > 1) {
        const mainRow = [reportIndex++, type, "", ""];
        XLSX.utils.sheet_add_aoa(worksheet, [mainRow], { origin: "A" + currentRow });
        currentRow++;

        periods.forEach((p, idx) => {
          const pages = idx === 0 ? p.pages : "";
          totalPages += idx === 0 ? p.pages : 0;
          const subRow = ["", "", p.period, pages];
          XLSX.utils.sheet_add_aoa(worksheet, [subRow], { origin: "A" + currentRow });
          currentRow++;
        });
      } else {
        const singleRow = [reportIndex++, type, periods[0].period, periods[0].pages];
        totalPages += periods[0].pages;
        XLSX.utils.sheet_add_aoa(worksheet, [singleRow], { origin: "A" + currentRow });
        currentRow++;
      }
    });

    applyStyles(worksheet, 6, currentRow - 1, tableHeader.length);

    const totalRow = ["", "TOTAL NO. OF PAGES", "", totalPages];
    XLSX.utils.sheet_add_aoa(worksheet, [totalRow], { origin: "A" + currentRow });
    applyStyles(worksheet, currentRow - 1, currentRow - 1, tableHeader.length, true);
    currentRow += 2;

    XLSX.utils.sheet_add_aoa(worksheet, [["Consolidated by:"]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [[""]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [["MARIA THERESA J. AGUIRRE"]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [["Chief HRS, PALD"]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [["Digitization Project Head"]], { origin: "A" + currentRow });
    currentRow += 2;
    XLSX.utils.sheet_add_aoa(worksheet, [["Noted by:"]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [["ATTY. ERNA T. ELIZAN"]], { origin: "A" + currentRow });
    currentRow++;
    XLSX.utils.sheet_add_aoa(worksheet, [["Acting Director III"]], { origin: "A" + currentRow });

    worksheet["!cols"] = [{ wch: 5 }, { wch: 50 }, { wch: 30 }, { wch: 15 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${periodName}_Report`);
    XLSX.writeFile(workbook, `${periodName}_Report.xlsx`);
  }

  const uniqueRoles = [...new Set(users.map((u) => u.role).filter((r) => r !== "ADMIN"))];

  const chartData = {
    labels: uniqueRoles,
    datasets: [
      {
        label: `Total Pages (Year ${currentYear})`,
        data: uniqueRoles.map((role) =>
          yearlyReports
            .filter((r) => r.role.toUpperCase() === role.toUpperCase())
            .reduce((sum, r) => sum + r.no_of_pages, 0)
        ),
        backgroundColor: ["#003087", "#C1272D", "#FFD700", "#00A86B", "#8B008B"],
        borderColor: ["#002060", "#a12025", "#e6c200", "#008B5D", "#6A006A"],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: `Total Pages per Department (Year ${currentYear})`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Number of Pages",
        },
      },
      x: {
        title: {
          display: true,
          text: "Department",
        },
      },
    },
  };

  const monthlyChartData = () => {
    const filteredReports = reports.filter((r) => {
      const reportDate = new Date(r.created_at);
      return (
        r.role.toUpperCase() === summaryRole.toUpperCase() &&
        reportDate.getFullYear() === parseInt(summaryYear) &&
        reportDate.getMonth() + 1 === parseInt(summaryMonth)
      );
    });

    return {
      labels: [...new Set(filteredReports.map((r) => r.type_of_record))],
      datasets: [
        {
          label: `Total Pages (${new Date(
            `${summaryYear}-${summaryMonth}-01`
          ).toLocaleString("default", { month: "long" })} ${summaryYear})`,
          data: [...new Set(filteredReports.map((r) => r.type_of_record))].map((type) =>
            filteredReports
              .filter((r) => r.type_of_record === type)
              .reduce((sum, r) => sum + r.no_of_pages, 0)
          ),
          backgroundColor: "#003087",
          borderColor: "#002060",
          borderWidth: 1,
        },
      ],
    };
  };

  const monthlyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: `Total Pages per Record Type (${new Date(
          `${summaryYear}-${summaryMonth}-01`
        ).toLocaleString("default", { month: "long" })} ${summaryYear})`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Number of Pages",
        },
      },
      x: {
        title: {
          display: true,
          text: "Type of Record",
        },
      },
    },
  };

  const years = Array.from({ length: 11 }, (_, i) => (parseInt(currentYear) - 5 + i).toString());

  const months = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  return (
    <div className="min-h-screen bg-[#F5F6F5] p-2 sm:p-4 md:p-6 relative">
      <Toaster position="top-right" />
      <div className="w-full max-w-full sm:max-w-5xl mx-auto bg-white rounded-lg shadow-lg p-3 sm:p-4 md:p-6 mt-6 sm:mt-8 md:mt-12">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 space-y-3 sm:space-y-0">
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <Image
              src="/logo.png"
              alt="Website Logo"
              width={120}
              height={40}
              priority
              className="w-24 sm:w-32 md:w-40"
            />
            <div className="text-center sm:text-left">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[#003087] font-['Poppins']">
                Admin Dashboard
              </h1>
              {user && (
                <p className="text-xs sm:text-sm text-gray-600">
                  Role: <span className="font-medium text-[#003087]">{user.role}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <div className="relative">
              <button
                onClick={() => setShowPendingModal(true)}
                className="py-1 px-2 sm:py-2 sm:px-4 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
              >
                Pending Registrations
              </button>
              {pendingRegistrations.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#C1272D] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingRegistrations.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setActiveSlider("users")}
              className="py-1 px-2 sm:py-2 sm:px-4 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
            >
              Manage Users
            </button>
            <button
              onClick={() => setActiveSlider("admin")}
              className="py-1 px-2 sm:py-2 sm:px-4 bg-[#C1272D] text-white rounded hover:bg-[#a12025] transition-colors font-medium text-xs sm:text-sm"
            >
              Manage Admin
            </button>
            <button
              onClick={logout}
              className="text-[#C1272D] hover:text-[#a12025] font-medium transition-colors text-xs sm:text-sm"
            >
              Logout
            </button>
          </div>
        </header>

        {uniqueRoles.map((role) => {
          const roleReports = reports.filter((r) => r.role.toUpperCase() === role.toUpperCase());
          const totalPages = roleReports.reduce((sum, r) => sum + r.no_of_pages, 0);

          return (
            <div key={role} className="mb-6 sm:mb-8">
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-[#003087] mb-3 sm:mb-4 font-['Poppins']">
                {role} Reports
              </h2>
              {roleReports.length === 0 ? (
                <p className="text-gray-500 text-xs sm:text-sm md:text-base">
                  No reports submitted for {role}.
                </p>
              ) : (
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full border-collapse table-auto text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-[#003087] text-white sticky top-0">
                        <th className="p-1 sm:p-2 text-left w-[40px] sm:w-[50px]">
                          No.
                        </th>
                        <th className="p-1 sm:p-2 text-left w-[150px] sm:w-[200px]">
                          Type of Record
                        </th>
                        <th className="p-1 sm:p-2 text-left w-[120px] sm:w-[150px]">
                          Period Covered
                        </th>
                        <th className="p-1 sm:p-2 text-left w-[80px] sm:w-[100px]">
                          No. of Pages
                        </th>
                        <th className="p-1 sm:p-2 text-left w-[80px] sm:w-[100px]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {roleReports.map((r, index) => (
                        <tr key={r.id} className="border-b hover:bg-[#F5F6F5]">
                          <td
                            className="p-1 sm:p-2 truncate text-[#003087]"
                            title={String(index + 1)}
                          >
                            {index + 1}
                          </td>
                          <td
                            className="p-1 sm:p-2 truncate text-[#003087]"
                            title={r.type_of_record}
                          >
                            {r.type_of_record}
                          </td>
                          <td
                            className="p-1 sm:p-2 truncate text-[#003087]"
                            title={r.period_covered}
                          >
                            {r.period_covered}
                          </td>
                          <td
                            className="p-1 sm:p-2 truncate text-[#003087]"
                            title={String(r.no_of_pages)}
                          >
                            {r.no_of_pages}
                          </td>
                          <td className="p-1 sm:p-2">
                            <button
                              onClick={() => setViewReport(r)}
                              className="text-[#003087] hover:text-[#002060] font-medium transition-colors text-xs sm:text-sm"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td
                          colSpan={3}
                          className="p-1 sm:p-2 text-right text-[#003087]"
                        >
                          Total No. of Pages
                        </td>
                        <td className="p-1 sm:p-2 text-[#003087]">
                          {totalPages}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-[#003087] mb-3 sm:mb-4 font-['Poppins']">
            Manage Type of Record Categories
          </h2>
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 mb-4">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="border border-gray-300 rounded p-1 sm:p-2 w-full sm:w-auto text-xs sm:text-sm text-[#003087]"
            >
              <option value="" disabled>Select Role</option>
              {uniqueRoles.map((role) => (
                <option key={role} value={role} className="text-[#003087]">
                  {role}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Enter new category"
              className="border border-gray-300 rounded p-1 sm:p-2 w-full sm:w-auto text-xs sm:text-sm text-[#003087]"
            />
            <button
              onClick={addCategory}
              className="py-1 px-2 sm:py-2 sm:px-4 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium w-full sm:w-auto text-xs sm:text-sm"
            >
              Add Category
            </button>
          </div>
          <div className="overflow-x-auto max-h-60">
            <table className="w-full border-collapse table-auto text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#003087] text-white sticky top-0">
                  <th className="p-1 sm:p-2 text-left w-[40px] sm:w-[50px]">
                    No.
                  </th>
                  <th className="p-1 sm:p-2 text-left w-[80px] sm:w-[100px]">
                    Role
                  </th>
                  <th className="p-1 sm:p-2 text-left w-[150px] sm:w-[200px]">
                    Category
                  </th>
                  <th className="p-1 sm:p-2 text-left w-[100px] sm:w-[100px]"></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, index) => (
                  <tr key={cat.id} className="border-b hover:bg-[#F5F6F5]">
                    <td className="p-1 sm:p-2 truncate text-[#003087]">
                      {index + 1}
                    </td>
                    <td className="p-1 sm:p-2 truncate text-[#003087]">
                      {cat.role}
                    </td>
                    <td className="p-1 sm:p-2 truncate text-[#003087]">
                      {editingCategory?.id === cat.id ? (
                        <input
                          type="text"
                          value={editingCategory.category}
                          onChange={(e) =>
                            setEditingCategory({
                              ...editingCategory,
                              category: e.target.value,
                            })
                          }
                          className="border border-gray-300 rounded p-1 w-full text-[#003087] text-xs sm:text-sm"
                        />
                      ) : (
                        cat.category
                      )}
                    </td>
                    <td className="p-1 sm:p-2 flex flex-wrap space-x-2">
                      {editingCategory?.id === cat.id ? (
                        <>
                          <button
                            onClick={() =>
                              updateCategory(cat.id, editingCategory.category)
                            }
                            className="text-[#003087] hover:text-[#002060] font-medium text-xs sm:text-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingCategory(null)}
                            className="text-[#C1272D] hover:text-[#a12025] font-medium text-xs sm:text-sm"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingCategory(cat)}
                            className="text-[#003087] hover:text-[#002060] font-medium text-xs sm:text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteCategory(cat.id)}
                            className="text-[#C1272D] hover:text-[#a12025] font-medium text-xs sm:text-sm"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-[#003087] mb-3 sm:mb-4 font-['Poppins']">
            Report per Office
          </h2>
          <div className="flex flex-col space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <select
                value={summaryMonth}
                onChange={(e) => setSummaryMonth(e.target.value)}
                className="border border-gray-300 rounded p-1 sm:p-2 w-full sm:w-auto text-xs sm:text-sm text-[#003087]"
              >
                <option value="" disabled className="text-gray-500">
                  Select Month
                </option>
                {months.map((month) => (
                  <option
                    key={month.value}
                    value={month.value}
                    className="text-[#003087]"
                  >
                    {month.label}
                  </option>
                ))}
              </select>
              <select
                value={summaryYear}
                onChange={(e) => setSummaryYear(e.target.value)}
                className="border border-gray-300 rounded p-1 sm:p-2 w-full sm:w-auto text-xs sm:text-sm text-[#003087]"
              >
                <option value="" disabled className="text-gray-500">
                  Select Year
                </option>
                {years.map((year) => (
                  <option key={year} value={year} className="text-[#003087]">
                    {year}
                  </option>
                ))}
              </select>
              <select
                value={summaryRole}
                onChange={(e) => setSummaryRole(e.target.value)}
                className="border border-gray-300 rounded p-1 sm:p-2 w-full sm:w-auto text-xs sm:text-sm text-[#003087]"
              >
                <option value="" disabled className="text-gray-500">
                  Select Role
                </option>
                {uniqueRoles.map((role) => (
                  <option key={role} value={role} className="text-[#003087]">
                    {role}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowMonthlySummary(true)}
                className="py-1 px-2 sm:py-2 sm:px-4 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium w-full sm:w-auto text-xs sm:text-sm"
              >
                View Summary
              </button>
            </div>
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
              <button
                onClick={() => generateRoleReport("monthly", summaryRole)}
                className="py-1 px-2 sm:py-2 sm:px-4 bg-[#C1272D] text-white rounded hover:bg-[#a12025] transition-colors font-medium w-full sm:w-auto text-xs sm:text-sm"
              >
                Download Monthly Report
              </button>
              <button
                onClick={() => generateRoleReport("yearly", summaryRole)}
                className="py-1 px-2 sm:py-2 sm:px-4 bg-[#C1272D] text-white rounded hover:bg-[#a12025] transition-colors font-medium w-full sm:w-auto text-xs sm:text-sm"
              >
                Download Yearly Report
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-[#003087] mb-3 sm:mb-4 font-['Poppins']">
            Regional Office Consolidated Report
          </h2>
          <div className="flex flex-col space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0">
              <button
                onClick={fetchYearlyReports}
                className="py-1 px-2 sm:py-2 sm:px-4 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
              >
                Annual Report
              </button>
              <button
                onClick={isReportGenerated ? downloadYearlyReport : fetchYearlyReports}
                className={
                  "py-1 px-2 sm:py-2 sm:px-4 font-medium text-white rounded transition-colors text-xs sm:text-sm " +
                  (isReportGenerated
                    ? "bg-[#C1272D] hover:bg-[#a12025]"
                    : "bg-[#003087] hover:bg-[#002060]")
                }
              >
                {isReportGenerated ? "Download Yearly Report" : "Generate Report"}
              </button>
              <button
                onClick={deleteOldReports}
                className="py-1 px-2 sm:py-2 sm:px-4 bg-[#C1272D] text-white rounded hover:bg-[#a12025] transition-colors font-medium text-xs sm:text-sm"
              >
                Delete Records
              </button>
            </div>
            <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <label className="text-[#003087] font-medium text-xs sm:text-sm md:text-base">
                Download Monthly Report:
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border border-gray-300 rounded p-1 sm:p-2 w-full sm:w-auto text-xs sm:text-sm text-[#003087]"
              >
                <option value="" disabled className="text-gray-500">
                  Select Month
                </option>
                {months.map((month) => (
                  <option
                    key={month.value}
                    value={month.value}
                    className="text-[#003087]"
                  >
                    {month.label}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="border border-gray-300 rounded p-1 sm:p-2 w-full sm:w-auto text-xs sm:text-sm text-[#003087]"
              >
                <option value="" disabled className="text-gray-500">
                  Select Year
                </option>
                {years.map((year) => (
                  <option key={year} value={year} className="text-[#003087]">
                    {year}
                  </option>
                ))}
              </select>
              <button
                onClick={downloadMonthlyReport}
                className="py-1 px-2 sm:py-2 sm:px-4 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium w-full sm:w-auto text-xs sm:text-sm"
              >
                Download Monthly Report
              </button>
            </div>
          </div>
        </div>

                <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-[#003087] mb-3 sm:mb-4 font-['Poppins']">
            Report Visualization
          </h2>
          <div className="h-64 sm:h-80">
            <Bar
              data={{
                labels: uniqueRoles,
                datasets: [
                  {
                    label: `Total Pages (Year ${currentYear})`,
                    data: uniqueRoles.map((role) =>
                      reports
                        .filter(
                          (r) =>
                            r.role.toUpperCase() === role.toUpperCase() &&
                            new Date(r.created_at).getFullYear() === parseInt(currentYear)
                        )
                        .reduce((sum, r) => sum + (r.no_of_pages || 0), 0)
                    ),
                    backgroundColor: ["#003087", "#C1272D", "#FFD700", "#00A86B", "#8B008B"],
                    borderColor: ["#002060", "#a12025", "#e6c200", "#008B5D", "#6A006A"],
                    borderWidth: 1,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "top",
                  },
                  title: {
                    display: true,
                    text: `Total Pages per Department (Year ${currentYear})`,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: "Number of Pages",
                    },
                  },
                  x: {
                    title: {
                      display: true,
                      text: "Department",
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        {showPendingModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-[#003087] font-['Poppins']">
                  Pending Registrations
                </h2>
                <button
                  onClick={() => setShowPendingModal(false)}
                  className="text-[#C1272D] hover:text-[#a12025] text-lg sm:text-xl"
                >
                  ✕
                </button>
              </div>
              {pendingRegistrations.length === 0 ? (
                <p className="text-gray-500 text-xs sm:text-sm md:text-base">No pending registrations.</p>
              ) : (
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full border-collapse table-auto text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-[#003087] text-white sticky top-0">
                        <th className="p-1 sm:p-2 text-center w-[50px] sm:w-[40px]">No.</th>
                        <th className="p-1 sm:p-2 text-left w-[120px] sm:w-[100px]">Name</th>
                        <th className="p-1 sm:p-2 text-left w-[100px] sm:w-[80px]">Role</th>
                        <th className="p-1 sm:p-2 text-left w-[150px] sm:w-[120px]">Office</th>
                        <th className="p-1 sm:p-2 text-left w-[200px] sm:w-[150px]">Email</th>
                        <th className="p-1 sm:p-2 text-center w-[100px] sm:w-[150px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRegistrations.map((r, index) => (
                        <tr key={r.id} className="border-b hover:bg-[#F5F6F5]">
                          <td className="p-1 sm:p-2 text-center truncate text-[#003087]">{index + 1}</td>
                          <td className="p-1 sm:p-2 truncate text-[#003087]">{r.name}</td>
                          <td className="p-1 sm:p-2 truncate text-[#003087]">{r.role}</td>
                          <td className="p-1 sm:p-2 truncate text-[#003087]">{r.office}</td>
                          <td className="p-1 sm:p-2 truncate text-[#003087]">{r.email_address}</td>
                          <td className="p-1 sm:p-2 text-center space-x-3">
                            <button
                              onClick={() => approveRegistration(r.id)}
                              className="text-[#003087] hover:text-[#002060] font-medium mr-2 text-xs sm:text-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => rejectRegistration(r.id)}
                              className="text-[#C1272D] hover:text-[#a12025] font-medium text-xs sm:text-sm"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {showYearlyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-lg w-full max-w-2xl sm:max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg md:text-xl font-semibold text-[#003087] font-['Poppins']">
                  Yearly Report {currentYear}
                </h2>
                <button
                  onClick={() => setShowYearlyModal(false)}
                  className="text-[#C1272D] hover:text-[#a12025] text-lg sm:text-xl"
                >
                  ✕
                </button>
              </div>
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full border-collapse table-auto text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#003087] text-white sticky top-0">
                      <th className="p-1 sm:p-2 text-center w-[40px] sm:w-[50px]">
                        No.
                      </th>
                      <th className="p-1 sm:p-2 text-left w-[150px] sm:w-[200px]">
                        Type of Record
                      </th>
                      <th className="p-1 sm:p-2 text-center w-[120px] sm:w-[150px]">
                        Period Covered
                      </th>
                      <th className="p-1 sm:p-2 text-center w-[80px] sm:w-[100px]">
                        No. of Pages
                      </th>
                      <th className="p-1 sm:p-2 text-center w-[80px] sm:w-[100px]">
                        Role
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyReports
                      .filter((r) => r.role !== "ADMIN")
                      .map((r, index) => (
                        <tr key={r.id} className="border-b hover:bg-[#F5F6F5]">
                          <td
                            className="p-1 sm:p-2 text-center truncate text-[#003087]"
                            title={String(index + 1)}
                          >
                            {index + 1}
                          </td>
                          <td
                            className="p-1 sm:p-2 text-left truncate text-[#003087]"
                            title={r.type_of_record}
                          >
                            {r.type_of_record}
                          </td>
                          <td
                            className="p-1 sm:p-2 text-center truncate text-[#003087]"
                            title={r.period_covered}
                          >
                            {r.period_covered}
                          </td>
                          <td
                            className="p-1 sm:p-2 text-center truncate text-[#003087]"
                            title={String(r.no_of_pages)}
                          >
                            {r.no_of_pages}
                          </td>
                          <td
                            className="p-1 sm:p-2 text-center truncate text-[#003087]"
                            title={r.role}
                          >
                            {r.role}
                          </td>
                        </tr>
                      ))}
                    <tr className="font-bold">
                      <td
                        colSpan={3}
                        className="p-1 sm:p-2 text-right text-[#003087]"
                      >
                        Total No. of Pages
                      </td>
                      <td
                        className="p-1 sm:p-2 text-center text-[#003087]"
                      >
                        {yearlyReports
                          .filter((r) => r.role !== "ADMIN")
                          .reduce((sum, r) => sum + r.no_of_pages, 0)}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => setShowYearlyModal(false)}
                className="mt-3 sm:mt-4 w-full py-1 sm:py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {showMonthlySummary && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-lg w-full max-w-md sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg md:text-xl font-semibold text-[#003087] font-['Poppins']">
                  Monthly Summary
                </h2>
                <button
                  onClick={() => setShowMonthlySummary(false)}
                  className="text-[#C1272D] hover:text-[#a12025] text-lg sm:text-xl"
                >
                  ✕
                </button>
              </div>
              <div className="mb-4 h-64 sm:h-80">
                <Bar data={monthlyChartData()} options={monthlyChartOptions} />
              </div>
              <button
                onClick={() => setShowMonthlySummary(false)}
                className="w-full py-1 sm:p-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-[#003087] mb-3 sm:mb-4 font-['Poppins']">
                Confirm Deletion
              </h2>
              <p className="text-gray-700 text-xs sm:text-sm md:text-base mb-4">
                Are you sure you want to delete the user <span className="font-medium text-[#003087]">
                  {users.find((u) => u.id === userToDelete)?.username}
                </span>? This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => userToDelete && deleteUser(userToDelete)}
                  className="flex-1 py-1 sm:p-2 bg-[#C1272D] text-white rounded hover:bg-[#a12025] transition-colors font-medium text-xs sm:text-sm"
                >
                  Delete
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setUserToDelete(null);
                  }}
                  className="flex-1 py-1 sm:p-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSlider === "users" && (
          <div
            className="fixed top-0 right-0 h-full w-[250px] sm:w-[300px] bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-50 translate-x-0"
          >
            <div className="p-3 sm:p-4">
              <div className="flex justify-between items-center mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-[#003087] font-['Poppins']">
                  Manage Users
                </h2>
                <button
                  onClick={() => setActiveSlider(null)}
                  className="text-[#C1272D] hover:text-[#a12025] text-lg sm:text-xl"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-3 sm:space-y-4">
                <select
                  value={selectedUser?.id || ""}
                  onChange={(e) => {
                    const user = users.find((u) => u.id === e.target.value);
                    setSelectedUser(user || null);
                    setNewUsername(user?.username || "");
                    setNewPassword("");
                  }}
                  className="border border-gray-300 rounded p-1 sm:p-2 w-full text-xs sm:text-sm text-[#003087]"
                >
                  <option value="" disabled>
                    Select user
                  </option>
                  {users
                    .filter((u) => u.role !== "ADMIN")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} ({u.role})
                      </option>
                    ))}
                </select>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="New Username"
                  className="border border-gray-300 rounded p-1 sm:p-2 w-full text-xs sm:text-sm text-[#003087]"
                />
                <div className="relative">
                  <input
                    type={showUserPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New Password"
                    className="border border-gray-300 rounded p-1 sm:p-2 w-full text-xs sm:text-sm text-[#003087]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUserPassword(!showUserPassword)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#003087] hover:text-[#002060] focus:outline-none text-xs sm:text-sm"
                  >
                    {showUserPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      if (!selectedUser) {
                        toast.error("Please select a user first.");
                        return;
                      }
                      updateUserCredentials();
                    }}
                    className="flex-1 py-1 sm:p-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-semibold text-xs sm:text-sm"
                  >
                    Update User
                  </button>
                  {selectedUser && (
                    <button
                      onClick={() => {
                        if (!selectedUser) {
                          toast.error("Please select a user first.");
                          return;
                        }
                        setUserToDelete(selectedUser.id);
                        setShowDeleteModal(true);
                      }}
                      className="flex-1 py-1 sm:p-2 bg-[#C1272D] text-white rounded hover:bg-[#a12025] transition-colors font-semibold text-xs sm:text-sm"
                    >
                      Delete User
                    </button>
                  )}
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => {
                      if (!selectedUser) {
                        toast.error("Please select a user first.");
                        return;
                      }
                      setShowUserDetailsModal(true);
                    }}
                    className="w-full py-1 sm:p-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
                  >
                    View User Details
                  </button>
                </div>
                {showUserDetailsModal && selectedUser && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4">
                    <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                      <div className="flex justify-between items-center mb-3 sm:mb-4">
                        <h2 className="text-base sm:text-lg md:text-xl font-bold text-[#003087] font-['Poppins']">
                          User Details
                        </h2>
                        <button
                          onClick={() => setShowUserDetailsModal(false)}
                          className="text-[#C1272D] hover:text-[#a12025] text-lg sm:text-xl"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-gray-700 text-xs sm:text-sm md:text-base">
                        <span className="font-medium text-[#003087]">Username:</span>{" "}
                        {selectedUser.username}
                      </p>
                      <p className="text-gray-700 text-xs sm:text-sm md:text-base">
                        <span className="font-medium text-[#003087]">Role:</span>{" "}
                        {selectedUser.role}
                      </p>
                      <p className="text-gray-700 text-xs sm:text-sm md:text-base">
                        <span className="font-medium text-[#003087]">Name:</span>{" "}
                        {selectedUser.name || "N/A"}
                      </p>
                      <p className="text-gray-700 text-xs sm:text-sm md:text-base">
                        <span className="font-medium text-[#003087]">Office:</span>{" "}
                        {selectedUser.office || "N/A"}
                      </p>
                      <p className="text-gray-700 text-xs sm:text-sm md:text-base">
                        <span className="font-medium text-[#003087]">Office Head:</span>{" "}
                        {selectedUser.office_head || "N/A"}
                      </p>
                      <p className="text-gray-700 text-xs sm:text-sm md:text-base">
                        <span className="font-medium text-[#003087]">Email:</span>{" "}
                        {selectedUser.email_address || "N/A"}
                      </p>
                      <button
                        onClick={() => setShowUserDetailsModal(false)}
                        className="mt-3 sm:mt-4 w-full py-1 sm:py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
                {activeSlider === "admin" && (
                  <div
                    className="fixed top-0 right-0 h-full w-[250px] sm:w-[300px] bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-50 translate-x-0"
                  >
                    <div className="p-3 sm:p-4">
                      <div className="flex justify-between items-center mb-3 sm:mb-4">
                        <h2 className="text-base sm:text-lg font-semibold text-[#003087] font-['Poppins']">
                          Manage Admin
                        </h2>
                        <button
                          onClick={() => setActiveSlider(null)}
                          className="text-[#C1272D] hover:text-[#a12025] text-lg sm:text-xl"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="space-y-3 sm:space-y-4">
                        <input
                          type="text"
                          value={adminNewUsername}
                          onChange={(e) => setAdminNewUsername(e.target.value)}
                          placeholder="New Username"
                          className="border border-gray-300 rounded p-1 sm:p-2 w-full text-xs sm:text-sm text-[#003087]"
                        />
                        <div className="relative">
                          <input
                            type={showAdminPassword ? "text" : "password"}
                            value={adminNewPassword}
                            onChange={(e) => setAdminNewPassword(e.target.value)}
                            placeholder="New Password"
                            className="border border-gray-300 rounded p-1 sm:p-2 w-full text-xs sm:text-sm text-[#003087]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowAdminPassword(!showAdminPassword)}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#003087] hover:text-[#002060] focus:outline-none text-xs sm:text-sm"
                          >
                            {showAdminPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                        <button
                          onClick={updateAdminCredentials}
                          className="w-full py-1 sm:p-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-semibold text-xs sm:text-sm"
                        >
                          Update Admin Credentials
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        }

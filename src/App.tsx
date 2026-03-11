import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { SetupAdmin } from './pages/SetupAdmin';
import { SetupRoute } from './components/SetupRoute';
import { AdminLayout } from './components/admin/AdminLayout';
import { StudentLayout } from './components/student/StudentLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { StudentManagement } from './pages/admin/StudentManagement';
import { UserManagement } from './pages/admin/UserManagement';
import { StudentMonitoring } from './pages/admin/StudentMonitoring';
import { LetterTemplates } from './pages/admin/LetterTemplates';
import { ApplicantDocuments } from './pages/admin/ApplicantDocuments';
import { Configuration } from './pages/admin/Configuration';
import { Analytics } from './pages/admin/Analytics';
import { FormBuilderPage } from './pages/admin/FormBuilder';
import { InterviewManagement } from './pages/admin/InterviewManagement';
import { ExamBuilder } from './pages/admin/ExamBuilder';
import { ExamTokenManagement } from './pages/admin/ExamTokenManagement';
import { DocxTemplateManagement } from './pages/admin/DocxTemplateManagement';
import { WhatsAppManagement } from './pages/admin/WhatsAppManagement';
import { RegistrationBatchManagement } from './pages/admin/RegistrationBatchManagement';
import { AcademicYearManagement } from './pages/admin/AcademicYearManagement';
import DatabaseBackup from './pages/admin/DatabaseBackup';
import InterviewCriteriaSettings from './pages/admin/InterviewCriteriaSettings';
import InterviewSessionPage from './pages/admin/InterviewSessionPage';
import InterviewReportPage from './pages/admin/InterviewReportPage';
import InterviewListPage from './pages/admin/InterviewListPage';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { ApplicationForm } from './pages/student/ApplicationForm';
import GenerateDocuments from './pages/student/GenerateDocuments';
import { InterviewBooking } from './pages/student/InterviewBooking';
import { ExamPortal } from './pages/student/ExamPortal';
import { AcademicYearProvider } from './contexts/AcademicYearContext';

function App() {
  return (
    <Router>
      <AuthProvider>
        <AcademicYearProvider>
          <Routes>
            <Route element={<SetupRoute />}>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/setup" element={<SetupAdmin />} />

              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="students" element={<StudentManagement />} />
                <Route path="interviews" element={<InterviewManagement />} />
                <Route path="exams" element={<ExamBuilder />} />
                <Route path="exam-tokens" element={<ExamTokenManagement />} />
                <Route path="documents" element={<ApplicantDocuments />} />
                <Route path="templates" element={<LetterTemplates />} />
                <Route path="docx-templates" element={<DocxTemplateManagement />} />
                <Route path="form-builder" element={<FormBuilderPage />} />
                <Route path="whatsapp" element={<WhatsAppManagement />} />
                <Route path="batches" element={<RegistrationBatchManagement />} />
                <Route path="academic-years" element={<AcademicYearManagement />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="student-monitoring" element={<StudentMonitoring />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="settings" element={<Configuration />} />
                <Route path="backup" element={<DatabaseBackup />} />
                <Route path="interview-criteria" element={<InterviewCriteriaSettings />} />
                <Route path="interview-list" element={<InterviewListPage />} />
                <Route path="interview-session/new" element={<InterviewSessionPage />} />
                <Route path="interview-session/:id" element={<InterviewSessionPage />} />
                <Route path="interview-session/:id/report" element={<InterviewReportPage />} />
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
              </Route>

              <Route
                path="/student/*"
                element={
                  <ProtectedRoute allowedRoles={['student']}>
                    <StudentLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="dashboard" element={<StudentDashboard />} />
                <Route path="application" element={<ApplicationForm />} />
                <Route path="interview" element={<InterviewBooking />} />
                <Route path="exams" element={<ExamPortal />} />
                <Route path="generate" element={<GenerateDocuments />} />
                <Route path="profile" element={<div className="text-slate-600">Coming soon: Profile</div>} />
                <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
              </Route>

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Route>
          </Routes>
        </AcademicYearProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;

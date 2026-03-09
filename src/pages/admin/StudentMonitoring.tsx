import { UserMonitoringTab } from '../../components/admin/UserMonitoringTab';

export const StudentMonitoring = () => {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Student Monitoring</h2>
                <p className="text-slate-600 mt-1">Monitor aktivitas, progress, dan laporan siswa secara menyeluruh</p>
            </div>
            <UserMonitoringTab />
        </div>
    );
};

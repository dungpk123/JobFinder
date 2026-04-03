import React from 'react';
import AdminTemplateManager from '../AdminTemplateManager';

const AdminTemplatesPage = ({ API_BASE, authHeaders, requestConfirm, mode = 'list' }) => (
    <div className="admin-module-shell">
        <AdminTemplateManager
            API_BASE={API_BASE}
            authHeaders={authHeaders}
            requestConfirm={requestConfirm}
            mode={mode}
        />
    </div>
);

export default AdminTemplatesPage;

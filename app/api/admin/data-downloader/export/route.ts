import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Authentication required' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { modules, filters, format } = body;

        if (!modules || !Array.isArray(modules) || modules.length === 0) {
            return NextResponse.json(
                { success: false, message: 'No modules selected for export' },
                { status: 400 }
            );
        }

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const exportData: Record<string, any[]> = {};
        const errors: Record<string, string> = {};

        // Map module IDs to entity types and API endpoints
        const moduleMap: Record<string, { entityType: string; endpoint: string }> = {
            'organizations': { entityType: 'organizations', endpoint: 'organizations' },
            'jobs': { entityType: 'jobs', endpoint: 'jobs' },
            'leads': { entityType: 'leads', endpoint: 'leads' },
            'job-seekers': { entityType: 'job-seekers', endpoint: 'job-seekers' },
            'hiring-managers': { entityType: 'hiring-managers', endpoint: 'hiring-managers' },
            'placements': { entityType: 'placements', endpoint: 'placements' },
            'tasks': { entityType: 'tasks', endpoint: 'tasks' },
        };

        // Fetch data for each module
        for (const moduleId of modules) {
            const moduleConfig = moduleMap[moduleId];
            if (!moduleConfig) {
                errors[moduleId] = `Unknown module: ${moduleId}`;
                continue;
            }

            try {
                // Build query parameters for filtering
                const queryParams = new URLSearchParams();
                if (filters?.startDate) {
                    queryParams.append('startDate', filters.startDate);
                }
                if (filters?.endDate) {
                    queryParams.append('endDate', filters.endDate);
                }
                if (filters?.status) {
                    queryParams.append('status', filters.status);
                }

                const queryString = queryParams.toString();
                const url = `${apiUrl}/api/${moduleConfig.endpoint}${queryString ? `?${queryString}` : ''}`;

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch data' }));
                    errors[moduleId] = errorData.message || `Failed to fetch ${moduleId}`;
                    continue;
                }

                const data = await response.json();
                
                // Extract data array (handle different response structures)
                let moduleData = data[moduleConfig.endpoint] || 
                               data.data || 
                               data[moduleId] ||
                               (Array.isArray(data) ? data : []);

                // Apply client-side filtering if backend doesn't support it
                if (filters?.startDate || filters?.endDate) {
                    moduleData = moduleData.filter((item: any) => {
                        const itemDate = item.created_at || item.updated_at || item.date_added;
                        if (!itemDate) return true;
                        
                        const itemDateObj = new Date(itemDate);
                        const startDate = filters.startDate ? new Date(filters.startDate) : null;
                        const endDate = filters.endDate ? new Date(filters.endDate) : null;
                        
                        if (startDate && itemDateObj < startDate) return false;
                        if (endDate && itemDateObj > endDate) return false;
                        return true;
                    });
                }

                if (filters?.status) {
                    moduleData = moduleData.filter((item: any) => {
                        const itemStatus = item.status || item.Status || '';
                        return String(itemStatus).toLowerCase().includes(filters.status.toLowerCase());
                    });
                }

                exportData[moduleId] = moduleData;
            } catch (err) {
                errors[moduleId] = err instanceof Error ? err.message : 'Unknown error';
            }
        }

        return NextResponse.json({
            success: true,
            data: exportData,
            errors: Object.keys(errors).length > 0 ? errors : undefined,
        });
    } catch (error) {
        console.error('Error exporting data:', error);
        return NextResponse.json(
            {
                success: false,
                message: error instanceof Error ? error.message : 'Internal server error',
            },
            { status: 500 }
        );
    }
}

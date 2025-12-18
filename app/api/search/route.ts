import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { matchesRecordId, parseRecordId } from '@/lib/recordIdFormatter';

// Global search across all entities
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('query');

        if (!query || query.trim().length === 0) {
            return NextResponse.json(
                { success: false, message: 'Search query is required' },
                { status: 400 }
            );
        }

        // Get the token from cookies
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Authentication required' },
                { status: 401 }
            );
        }

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const searchTerm = query.trim().toLowerCase();
        
        // Parse prefixed ID if present (e.g., "J8" -> {id: 8, type: 'job'})
        const parsedId = parseRecordId(query.trim());

        // Search across all entities in parallel
        const [jobsRes, leadsRes, jobSeekersRes, organizationsRes, tasksRes, hiringManagersRes, placementsRes] = await Promise.allSettled([
            // Jobs - fetch all and filter
            fetch(`${apiUrl}/api/jobs`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(res => res.ok ? res.json() : { jobs: [] }).catch(() => ({ jobs: [] })),
            
            // Leads - use search endpoint or fetch all
            fetch(`${apiUrl}/api/leads/search/query?query=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(res => res.ok ? res.json() : { leads: [] }).catch(() => 
                // Fallback: fetch all leads if search endpoint fails
                fetch(`${apiUrl}/api/leads`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(res => res.ok ? res.json() : { leads: [] }).catch(() => ({ leads: [] }))
            ),
            
            // Job Seekers - fetch all and filter
            fetch(`${apiUrl}/api/job-seekers`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(res => res.ok ? res.json() : { jobSeekers: [] }).catch(() => ({ jobSeekers: [] })),
            
            // Organizations - fetch all and filter
            fetch(`${apiUrl}/api/organizations`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(res => res.ok ? res.json() : { organizations: [] }).catch(() => ({ organizations: [] })),
            
            // Tasks - fetch all and filter
            fetch(`${apiUrl}/api/tasks`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(res => res.ok ? res.json() : { tasks: [] }).catch(() => ({ tasks: [] })),
            
            // Hiring Managers - fetch all and filter
            fetch(`${apiUrl}/api/hiring-managers`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(res => res.ok ? res.json() : { hiringManagers: [] }).catch(() => ({ hiringManagers: [] })),
            
            // Placements - fetch all and filter
            fetch(`${apiUrl}/api/placements`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(res => res.ok ? res.json() : { placements: [] }).catch(() => ({ placements: [] }))
        ]);

        const results: any = {
            jobs: [],
            leads: [],
            jobSeekers: [],
            organizations: [],
            tasks: [],
            hiringManagers: [],
            placements: []
        };

        // Helper function to check if a value matches search term
        const matchesSearch = (value: any): boolean => {
            if (!value && value !== 0) return false; // Allow 0 as a valid value
            const strValue = String(value).toLowerCase();
            return strValue.includes(searchTerm);
        };
        
        // Helper function to check if a record ID matches (with prefix support)
        const matchesId = (id: any, type: 'job' | 'jobSeeker' | 'organization' | 'lead' | 'task' | 'placement' | 'hiringManager'): boolean => {
            if (!id && id !== 0) return false;
            
            // If parsed ID exists and matches this type, check if IDs match
            if (parsedId && parsedId.type === type && parsedId.id === Number(id)) {
                return true;
            }
            
            // Also check regular string matching
            return matchesSearch(id);
        };

        // Process jobs results
        if (jobsRes.status === 'fulfilled') {
            try {
                const data = jobsRes.value;
                const jobs = data.jobs || data || [];
                results.jobs = jobs.filter((job: any) => 
                    matchesSearch(job.job_title) ||
                    matchesSearch(job.title) ||
                    matchesSearch(job.company_name) ||
                    matchesSearch(job.organization_name) ||
                    matchesSearch(job.location) ||
                    matchesSearch(job.description) ||
                    matchesId(job.id, 'job')
                );
            } catch (e) {
                console.error('Error processing jobs results:', e);
            }
        }

        // Process leads results
        if (leadsRes.status === 'fulfilled') {
            try {
                const data = leadsRes.value;
                const leads = data.leads || data || [];
                // If leads is an array, filter it; otherwise use as-is
                results.leads = Array.isArray(leads) ? leads.filter((lead: any) =>
                    matchesSearch(lead.name) ||
                    matchesSearch(lead.first_name) ||
                    matchesSearch(lead.last_name) ||
                    matchesSearch(lead.company_name) ||
                    matchesSearch(lead.email) ||
                    matchesSearch(lead.phone) ||
                    matchesId(lead.id, 'lead')
                ) : leads;
            } catch (e) {
                console.error('Error processing leads results:', e);
            }
        }

        // Process job seekers results
        if (jobSeekersRes.status === 'fulfilled') {
            try {
                const data = jobSeekersRes.value;
                const jobSeekers = data.jobSeekers || data || [];
                results.jobSeekers = jobSeekers.filter((js: any) =>
                    matchesSearch(js.first_name) ||
                    matchesSearch(js.last_name) ||
                    matchesSearch(js.name) ||
                    matchesSearch(js.email) ||
                    matchesSearch(js.phone) ||
                    matchesSearch(js.title) ||
                    matchesId(js.id, 'jobSeeker')
                );
            } catch (e) {
                console.error('Error processing job seekers results:', e);
            }
        }

        // Process organizations results
        if (organizationsRes.status === 'fulfilled') {
            try {
                const data = organizationsRes.value;
                const organizations = data.organizations || data || [];
                results.organizations = organizations.filter((org: any) =>
                    matchesSearch(org.name) ||
                    matchesSearch(org.website) ||
                    matchesSearch(org.phone) ||
                    matchesSearch(org.address) ||
                    matchesSearch(org.overview) ||
                    matchesId(org.id, 'organization')
                );
            } catch (e) {
                console.error('Error processing organizations results:', e);
            }
        }

        // Process tasks results
        if (tasksRes.status === 'fulfilled') {
            try {
                const data = tasksRes.value;
                const tasks = data.tasks || data || [];
                results.tasks = tasks.filter((task: any) =>
                    matchesSearch(task.title) ||
                    matchesSearch(task.task_title) ||
                    matchesSearch(task.description) ||
                    matchesSearch(task.notes) ||
                    matchesId(task.id, 'task')
                );
            } catch (e) {
                console.error('Error processing tasks results:', e);
            }
        }

        // Process hiring managers results
        if (hiringManagersRes.status === 'fulfilled') {
            try {
                const data = hiringManagersRes.value;
                const hiringManagers = data.hiringManagers || data.hiring_managers || data || [];
                results.hiringManagers = (Array.isArray(hiringManagers) ? hiringManagers : []).filter((hm: any) =>
                    matchesSearch(hm.name) ||
                    matchesSearch(hm.first_name) ||
                    matchesSearch(hm.last_name) ||
                    matchesSearch(hm.email) ||
                    matchesSearch(hm.phone) ||
                    matchesSearch(hm.organization_name) ||
                    matchesId(hm.id, 'hiringManager')
                );
            } catch (e) {
                console.error('Error processing hiring managers results:', e);
            }
        }

        // Process placements results
        if (placementsRes.status === 'fulfilled') {
            try {
                const data = placementsRes.value;
                const placements = data.placements || data || [];
                results.placements = (Array.isArray(placements) ? placements : []).filter((placement: any) =>
                    matchesSearch(placement.job_title) ||
                    matchesSearch(placement.jobSeekerName) ||
                    matchesSearch(placement.job_seeker_name) ||
                    matchesSearch(placement.status) ||
                    matchesId(placement.id, 'placement')
                );
            } catch (e) {
                console.error('Error processing placements results:', e);
            }
        }

        return NextResponse.json({
            success: true,
            query: query.trim(),
            results
        });
    } catch (error) {
        console.error('Error in global search:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}


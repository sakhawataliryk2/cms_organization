import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseRecordId } from '@/lib/recordIdFormatter';

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
        const trimmedQuery = query.trim();
        // Split into terms so "o 54" → ["o", "54"]: a record must match ALL terms (in ID or in title/other fields)
        const terms = trimmedQuery.split(/\s+/).filter(Boolean);
        
        // Parse prefixed ID if present (e.g., "O54", "O 54" -> {id: 54, type: 'organization'})
        const parsedId = parseRecordId(trimmedQuery);

        // When user searches by prefixed ID (O54, J8, JS123, etc.), fetch that record by ID so it always appears
        const backendPathByType: Record<string, string> = {
            job: '/api/jobs',
            lead: '/api/leads',
            jobSeeker: '/api/job-seekers',
            organization: '/api/organizations',
            task: '/api/tasks',
            hiringManager: '/api/hiring-managers',
            placement: '/api/placements',
        };
        const fetchByIdPromise = parsedId && backendPathByType[parsedId.type]
            ? fetch(`${apiUrl}${backendPathByType[parsedId.type]}/${parsedId.id}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            })
                .then(async (res) => {
                    if (!res.ok) return { type: parsedId!.type, data: null };
                    const data = await res.json();
                    const single = data.organization ?? data.job ?? data.lead ?? data.jobSeeker ?? data.task ?? data.hiringManager ?? data.placement ?? data;
                    return { type: parsedId!.type, data: single };
                })
                .catch(() => ({ type: parsedId!.type, data: null }))
            : null;

        // Search across all entities in parallel
        const [jobsRes, leadsRes, jobSeekersRes, organizationsRes, tasksRes, hiringManagersRes, placementsRes, byIdRes] = await Promise.allSettled([
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
            }).then(res => res.ok ? res.json() : { placements: [] }).catch(() => ({ placements: [] })),
            // Prefixed-ID lookup (e.g. O54, J8) – ensures the exact record is always included
            ...(fetchByIdPromise ? [fetchByIdPromise] : [Promise.resolve(null)])
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

        // Require ALL terms to appear in a single value (used by recordMatchesAllTerms across fields)
        // Record matches text if every term appears in at least one of the given fields
        const recordMatchesAllTerms = (record: any, fieldKeys: string[]): boolean => {
            if (terms.length === 0) return false;
            return terms.every((term) =>
                fieldKeys.some((key) =>
                    String(record[key] ?? '').toLowerCase().includes(term.toLowerCase())
                )
            );
        };
        // Helper: record ID matches prefixed ID (e.g. O 54 → org 54) or id string contains all terms
        const matchesId = (id: any, type: 'job' | 'jobSeeker' | 'organization' | 'lead' | 'task' | 'placement' | 'hiringManager'): boolean => {
            if (id === undefined || id === null) return id === 0;
            if (parsedId && parsedId.type === type && parsedId.id === Number(id)) return true;
            if (terms.length === 0) return false;
            const idStr = String(id).toLowerCase();
            return terms.every((t) => idStr.includes(t.toLowerCase()));
        };

        // Process jobs results: match prefixed ID (e.g. J8) OR all terms in id/title/other fields
        const jobFields = ['job_title', 'title', 'company_name', 'organization_name', 'location', 'description', 'id'];
        if (jobsRes.status === 'fulfilled') {
            try {
                const data = jobsRes.value;
                const jobs = data.jobs || data || [];
                results.jobs = jobs.filter((job: any) =>
                    matchesId(job.id, 'job') || recordMatchesAllTerms(job, jobFields)
                );
            } catch (e) {
                console.error('Error processing jobs results:', e);
            }
        }

        // Process leads results
        const leadFields = ['name', 'first_name', 'last_name', 'company_name', 'email', 'phone', 'id'];
        if (leadsRes.status === 'fulfilled') {
            try {
                const data = leadsRes.value;
                const leads = data.leads || data || [];
                results.leads = Array.isArray(leads) ? leads.filter((lead: any) =>
                    matchesId(lead.id, 'lead') || recordMatchesAllTerms(lead, leadFields)
                ) : leads;
            } catch (e) {
                console.error('Error processing leads results:', e);
            }
        }

        // Process job seekers results
        const jobSeekerFields = ['first_name', 'last_name', 'name', 'email', 'phone', 'title', 'id'];
        if (jobSeekersRes.status === 'fulfilled') {
            try {
                const data = jobSeekersRes.value;
                const jobSeekers = data.jobSeekers || data || [];
                results.jobSeekers = jobSeekers.filter((js: any) =>
                    matchesId(js.id, 'jobSeeker') || recordMatchesAllTerms(js, jobSeekerFields)
                );
            } catch (e) {
                console.error('Error processing job seekers results:', e);
            }
        }

        // Process organizations results
        const orgFields = ['name', 'website', 'phone', 'address', 'overview', 'id'];
        if (organizationsRes.status === 'fulfilled') {
            try {
                const data = organizationsRes.value;
                const organizations = data.organizations || data || [];
                results.organizations = organizations.filter((org: any) =>
                    matchesId(org.id, 'organization') || recordMatchesAllTerms(org, orgFields)
                );
            } catch (e) {
                console.error('Error processing organizations results:', e);
            }
        }

        // Process tasks results
        const taskFields = ['title', 'task_title', 'description', 'notes', 'id'];
        if (tasksRes.status === 'fulfilled') {
            try {
                const data = tasksRes.value;
                const tasks = data.tasks || data || [];
                results.tasks = tasks.filter((task: any) =>
                    matchesId(task.id, 'task') || recordMatchesAllTerms(task, taskFields)
                );
            } catch (e) {
                console.error('Error processing tasks results:', e);
            }
        }

        // Process hiring managers results
        const hmFields = ['name', 'first_name', 'last_name', 'email', 'phone', 'organization_name', 'id'];
        if (hiringManagersRes.status === 'fulfilled') {
            try {
                const data = hiringManagersRes.value;
                const hiringManagers = data.hiringManagers || data.hiring_managers || data || [];
                results.hiringManagers = (Array.isArray(hiringManagers) ? hiringManagers : []).filter((hm: any) =>
                    matchesId(hm.id, 'hiringManager') || recordMatchesAllTerms(hm, hmFields)
                );
            } catch (e) {
                console.error('Error processing hiring managers results:', e);
            }
        }

        // Process placements results
        const placementFields = ['job_title', 'jobSeekerName', 'job_seeker_name', 'status', 'id'];
        if (placementsRes.status === 'fulfilled') {
            try {
                const data = placementsRes.value;
                const placements = data.placements || data || [];
                results.placements = (Array.isArray(placements) ? placements : []).filter((placement: any) =>
                    matchesId(placement.id, 'placement') || recordMatchesAllTerms(placement, placementFields)
                );
            } catch (e) {
                console.error('Error processing placements results:', e);
            }
        }

        // When user searched by prefixed ID (O54, J8, O 54, etc.), ensure that exact record is in results
        const resultsKeyByType: Record<string, keyof typeof results> = {
            organization: 'organizations', job: 'jobs', lead: 'leads', jobSeeker: 'jobSeekers',
            task: 'tasks', hiringManager: 'hiringManagers', placement: 'placements',
        };
        if (byIdRes?.status === 'fulfilled' && byIdRes.value?.data) {
            const { type, data } = byIdRes.value;
            const key = resultsKeyByType[type];
            if (key) {
                const arr = results[key];
                const exists = Array.isArray(arr) && arr.some((r: any) => Number(r?.id) === Number(data?.id));
                if (!exists) (results as any)[key] = [data, ...(Array.isArray(arr) ? arr : [])];
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


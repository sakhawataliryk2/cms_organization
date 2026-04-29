import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseRecordId, RECORD_PREFIXES } from '@/lib/recordIdFormatter';

// Global search across all entities
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('query');
        const limitParam = Number.parseInt(searchParams.get('limit') || '', 10);
        const perEntityLimit = Number.isFinite(limitParam) && limitParam > 0
            ? Math.min(limitParam, 20)
            : 8;

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
        const normalizedQuery = trimmedQuery.toLowerCase().replace(/[^a-z0-9]/g, '');
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
            ? (async () => {
                const normalizeSingle = (data: any) =>
                    data.organization ?? data.job ?? data.lead ?? data.jobSeeker ?? data.task ?? data.hiringManager ?? data.placement ?? data;
                const isExactRecordMatch = (item: any) =>
                    Number(item?.id) === Number(parsedId.id) ||
                    Number(item?.record_number ?? item?.recordNumber) === Number(parsedId.id);

                // 1) Try direct :id lookup first.
                try {
                    const byPkRes = await fetch(`${apiUrl}${backendPathByType[parsedId.type]}/${parsedId.id}`, {
                        headers: { 'Authorization': `Bearer ${token}` },
                    });
                    if (byPkRes.ok) {
                        const byPkData = normalizeSingle(await byPkRes.json());
                        if (byPkData && isExactRecordMatch(byPkData)) {
                            return { type: parsedId.type, data: byPkData };
                        }
                    }
                } catch {
                    // ignore and continue with fallback strategy
                }

                // 2) Fallback by searching list endpoint with numeric part and exact record_number match.
                try {
                    let listUrl = `${apiUrl}${backendPathByType[parsedId.type]}?search=${encodeURIComponent(String(parsedId.id))}&limit=200&page=1`;
                    // Leads and hiring managers use dedicated search endpoints in this backend.
                    if (parsedId.type === 'lead') {
                        listUrl = `${apiUrl}/api/leads/search/query?query=${encodeURIComponent(String(parsedId.id))}`;
                    } else if (parsedId.type === 'hiringManager') {
                        listUrl = `${apiUrl}/api/hiring-managers/search/query?query=${encodeURIComponent(String(parsedId.id))}`;
                    }
                    const listRes = await fetch(listUrl, {
                        headers: { 'Authorization': `Bearer ${token}` },
                    });
                    if (listRes.ok) {
                        const listData = await listRes.json();
                        const collection =
                            listData.organizations ??
                            listData.jobs ??
                            listData.leads ??
                            listData.jobSeekers ??
                            listData.tasks ??
                            listData.hiringManagers ??
                            listData.placements ??
                            [];
                        if (Array.isArray(collection)) {
                            const exact = collection.find(isExactRecordMatch);
                            if (exact) return { type: parsedId.type, data: exact };
                        }
                    }
                } catch {
                    // ignore
                }

                return { type: parsedId.type, data: null };
            })()
            : null;

        // Search across all entities in parallel
        const [jobsRes, leadsRes, jobSeekersRes, organizationsRes, tasksRes, hiringManagersRes, placementsRes, byIdRes] = await Promise.allSettled([
            // Jobs - backend query with paging
            fetch(`${apiUrl}/api/jobs?search=${encodeURIComponent(query)}&limit=${perEntityLimit}&page=1`, {
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
            
            // Job Seekers - no dedicated search endpoint yet, fallback to list + in-route filtering
            fetch(`${apiUrl}/api/job-seekers`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(res => res.ok ? res.json() : { jobSeekers: [] }).catch(() => ({ jobSeekers: [] })),
            
            // Organizations - backend query with paging
            fetch(`${apiUrl}/api/organizations?search=${encodeURIComponent(query)}&limit=${perEntityLimit}&page=1`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(res => res.ok ? res.json() : { organizations: [] }).catch(() => ({ organizations: [] })),
            
            // Tasks - no dedicated search endpoint yet, fallback to list + in-route filtering
            fetch(`${apiUrl}/api/tasks`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(res => res.ok ? res.json() : { tasks: [] }).catch(() => ({ tasks: [] })),
            
            // Hiring Managers - backend search endpoint
            fetch(`${apiUrl}/api/hiring-managers/search/query?query=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(res => res.ok ? res.json() : { hiringManagers: [] }).catch(() => ({ hiringManagers: [] })),
            
            // Placements - no dedicated search endpoint yet, fallback to list + in-route filtering
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
        const matchesId = (
            id: any,
            type: 'job' | 'jobSeeker' | 'organization' | 'lead' | 'task' | 'placement' | 'hiringManager',
            recordNumber?: any,
        ): boolean => {
            if ((id === undefined || id === null) && (recordNumber === undefined || recordNumber === null)) {
                return false;
            }
            if (
                parsedId &&
                parsedId.type === type &&
                (parsedId.id === Number(id) || parsedId.id === Number(recordNumber))
            ) {
                return true;
            }
            if (terms.length === 0) return false;
            const idStr = String(id ?? '').toLowerCase();
            const recordNumberStr = String(recordNumber ?? '').toLowerCase();
            const prefix = RECORD_PREFIXES[type].toLowerCase();
            const normalizedId = String(id ?? '').replace(/[^a-z0-9]/g, '');
            const normalizedRecordNumber = String(recordNumber ?? '').replace(/[^a-z0-9]/g, '');

            // Support compact prefixed queries like "o1", "o 1", "hm12" against both id and record_number.
            if (normalizedQuery && prefix) {
                const prefixedId = `${prefix}${normalizedId}`;
                const prefixedRecordNumber = `${prefix}${normalizedRecordNumber}`;
                if (
                    prefixedId.includes(normalizedQuery) ||
                    prefixedRecordNumber.includes(normalizedQuery)
                ) {
                    return true;
                }
            }

            return terms.every((t) => {
                const needle = t.toLowerCase();
                return idStr.includes(needle) || recordNumberStr.includes(needle);
            });
        };

        // Process jobs results: match prefixed ID (e.g. J8) OR all terms in id/title/other fields
        const jobFields = ['job_title', 'title', 'company_name', 'organization_name', 'location', 'description', 'id'];
        if (jobsRes.status === 'fulfilled') {
            try {
                const data = jobsRes.value;
                const jobs = data.jobs || data || [];
                results.jobs = jobs
                    .filter((job: any) =>
                        matchesId(job.id, 'job', job.record_number ?? job.recordNumber) ||
                        recordMatchesAllTerms(job, [...jobFields, 'record_number', 'recordNumber'])
                    )
                    .slice(0, perEntityLimit);
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
                results.leads = Array.isArray(leads)
                    ? leads
                        .filter((lead: any) =>
                            matchesId(lead.id, 'lead', lead.record_number ?? lead.recordNumber) ||
                            recordMatchesAllTerms(lead, [...leadFields, 'record_number', 'recordNumber'])
                        )
                        .slice(0, perEntityLimit)
                    : leads;
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
                results.jobSeekers = jobSeekers
                    .filter((js: any) =>
                        matchesId(js.id, 'jobSeeker', js.record_number ?? js.recordNumber) ||
                        recordMatchesAllTerms(js, [...jobSeekerFields, 'record_number', 'recordNumber'])
                    )
                    .slice(0, perEntityLimit);
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
                results.organizations = organizations
                    .filter((org: any) =>
                        matchesId(org.id, 'organization', org.record_number ?? org.recordNumber) ||
                        recordMatchesAllTerms(org, [...orgFields, 'record_number', 'recordNumber'])
                    )
                    .slice(0, perEntityLimit);
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
                results.tasks = tasks
                    .filter((task: any) =>
                        matchesId(task.id, 'task', task.record_number ?? task.recordNumber) ||
                        recordMatchesAllTerms(task, [...taskFields, 'record_number', 'recordNumber'])
                    )
                    .slice(0, perEntityLimit);
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
                results.hiringManagers = (Array.isArray(hiringManagers) ? hiringManagers : [])
                    .filter((hm: any) =>
                        matchesId(hm.id, 'hiringManager', hm.record_number ?? hm.recordNumber) ||
                        recordMatchesAllTerms(hm, [...hmFields, 'record_number', 'recordNumber'])
                    )
                    .slice(0, perEntityLimit);
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
                results.placements = (Array.isArray(placements) ? placements : [])
                    .filter((placement: any) =>
                        matchesId(placement.id, 'placement', placement.record_number ?? placement.recordNumber) ||
                        recordMatchesAllTerms(placement, [...placementFields, 'record_number', 'recordNumber'])
                    )
                    .slice(0, perEntityLimit);
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


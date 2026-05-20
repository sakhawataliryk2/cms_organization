import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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
        
        // Prefix mapping
        const PREFIX_MAP: Record<string, string> = {
            'O': 'organization', 'J': 'job', 'JS': 'jobSeeker', 'L': 'lead',
            'HM': 'hiringManager', 'T': 'task', 'P': 'placement'
        };
        
        // Parse prefixed ID from query (e.g., "O10", "O 10", "JS13" -> {type: 'organization', recordNumber: 10})
        const parsePrefixedId = (q: string): { type: string; recordNumber: number } | null => {
            const upper = q.toUpperCase().replace(/\s+/g, ' ').trim();
            for (const [prefix, entityType] of Object.entries(PREFIX_MAP)) {
                if (upper.startsWith(prefix)) {
                    const numPart = upper.substring(prefix.length).replace(/^\s+/, '');
                    const num = parseInt(numPart, 10);
                    if (num && num > 0) {
                        return { type: entityType, recordNumber: num };
                    }
                }
            }
            return null;
        };
        
        // Check if query is a prefixed ID search (e.g., "O10", "J5")
        const prefixedSearch = parsePrefixedId(trimmedQuery);
        
        // If it's a prefixed ID search, we need to fetch that specific table and filter by record_number
        if (prefixedSearch) {
            const { type, recordNumber } = prefixedSearch;
            
            // Define endpoint and response key for each type
            const endpointConfig: Record<string, { endpoint: string; responseKey: string; usesQueryParam?: boolean }> = {
                organization: { endpoint: '/api/organizations', responseKey: 'organizations' },
                job: { endpoint: '/api/jobs', responseKey: 'jobs' },
                lead: { endpoint: '/api/leads/search/query', responseKey: 'leads', usesQueryParam: true },
                jobSeeker: { endpoint: '/api/job-seekers', responseKey: 'jobSeekers' },
                task: { endpoint: '/api/tasks', responseKey: 'tasks' },
                hiringManager: { endpoint: '/api/hiring-managers/search/query', responseKey: 'hiringManagers', usesQueryParam: true },
                placement: { endpoint: '/api/placements', responseKey: 'placements' },
            };
            
            const config = endpointConfig[type];
            if (!config) {
                return NextResponse.json({ success: true, query, results: getEmptyResults() });
            }
            
            try {
                // For prefixed ID searches, we need to find records by record_number
                // Records are sorted by record_number descending, so low record_numbers are at higher page numbers
                
                const results = getEmptyResults();
                const paramName = config.usesQueryParam ? 'query' : 'search';
                
                // Try fetching with search parameter first (faster if backend matches record_number)
                let matchedRecords: any[] = [];
                let found = false;
                
                // Strategy 1: Try with search parameter
                const searchUrl = `${apiUrl}${config.endpoint}?${paramName}=${recordNumber}&limit=500&page=1`;
                const searchResponse = await fetch(searchUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (searchResponse.ok) {
                    const searchData = await searchResponse.json();
                    const searchCollection = searchData[config.responseKey] || [];
                    
                    matchedRecords = searchCollection.filter((record: any) => {
                        const recNum = Number(record.record_number ?? record.recordNumber);
                        return recNum === recordNumber;
                    });
                    
                    if (matchedRecords.length > 0) {
                        found = true;
                    }
                }
                
                // Strategy 2: If not found and we have total count, calculate which page the record would be on
                // Records appear to be sorted by record_number descending, so lower numbers are on higher pages
                if (!found && matchedRecords.length === 0) {
                    const pageSize = 500;
                    // Estimate page based on total records - records are sorted descending
                    // If total is 44322 and we're looking for record_number 10, 
                    // it would be near the end (page ~89)
                    
                    // Try fetching from estimated page
                    for (const pageEstimate of [85, 86, 87, 88, 89, 90]) {
                        const pageUrl = `${apiUrl}${config.endpoint}?${paramName}=&limit=${pageSize}&page=${pageEstimate}`;
                        const pageResponse = await fetch(pageUrl, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        
                        if (!pageResponse.ok) break;
                        
                        const pageData = await pageResponse.json();
                        const pageCollection = pageData[config.responseKey] || [];
                        
                        if (!Array.isArray(pageCollection) || pageCollection.length === 0) break;
                        
                        // Find the record with matching record_number
                        const foundInPage = pageCollection.filter((record: any) => {
                            const recNum = Number(record.record_number ?? record.recordNumber);
                            return recNum === recordNumber;
                        });
                        
                        if (foundInPage.length > 0) {
                            matchedRecords = foundInPage;
                            found = true;
                            break;
                        }
                    }
                }
                
                (results as any)[config.responseKey] = matchedRecords.slice(0, perEntityLimit);
                
                return NextResponse.json({
                    success: true,
                    query,
                    results,
                    matchedBy: 'record_number',
                    matchedType: type,
                    matchedNumber: recordNumber,
                    found
                });
            } catch (e) {
                console.error(`Error fetching ${type} for prefix search:`, e);
            }
            
            return NextResponse.json({ success: true, query, results: getEmptyResults() });
        }
        
        // Normal search - no prefixed ID, search across all entities
        const terms = trimmedQuery.split(/\s+/).filter(Boolean);
        
        // Fetch all entities in parallel
        const [jobsRes, leadsRes, jobSeekersRes, organizationsRes, tasksRes, hiringManagersRes, placementsRes] = await Promise.allSettled([
            fetch(`${apiUrl}/api/jobs?search=${encodeURIComponent(query)}&limit=${perEntityLimit}&page=1`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => res.ok ? res.json() : { jobs: [] }).catch(() => ({ jobs: [] })),
            
            fetch(`${apiUrl}/api/leads/search/query?query=${encodeURIComponent(query)}&limit=200`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => res.ok ? res.json() : 
                fetch(`${apiUrl}/api/leads?search=${encodeURIComponent(query)}&limit=200`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(res => res.ok ? res.json() : { leads: [] }).catch(() => ({ leads: [] }))
            ),
            
            fetch(`${apiUrl}/api/job-seekers?search=${encodeURIComponent(query)}&limit=200`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => res.ok ? res.json() : { jobSeekers: [] }).catch(() => ({ jobSeekers: [] })),
            
            fetch(`${apiUrl}/api/organizations?search=${encodeURIComponent(query)}&limit=${perEntityLimit}&page=1`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => res.ok ? res.json() : { organizations: [] }).catch(() => ({ organizations: [] })),
            
            fetch(`${apiUrl}/api/tasks?search=${encodeURIComponent(query)}&limit=200`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => res.ok ? res.json() : { tasks: [] }).catch(() => ({ tasks: [] })),
            
            fetch(`${apiUrl}/api/hiring-managers/search/query?query=${encodeURIComponent(query)}&limit=200`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => res.ok ? res.json() : { hiringManagers: [] }).catch(() => ({ hiringManagers: [] })),
            
            fetch(`${apiUrl}/api/placements?search=${encodeURIComponent(query)}&limit=200`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => res.ok ? res.json() : { placements: [] }).catch(() => ({ placements: [] })),
        ]);

        // Helper to check if record matches terms
        const recordMatchesTerms = (record: any, fieldKeys: string[]): boolean => {
            if (terms.length === 0) return false;
            
            const getFieldValue = (rec: any, key: string): string => {
                const parts = key.split('.');
                let val: any = rec;
                for (const part of parts) {
                    if (val === null || val === undefined) return '';
                    val = val[part];
                }
                return String(val ?? '');
            };
            
            // Check if ANY term matches in ANY field
            return terms.some((term) =>
                fieldKeys.some((key) =>
                    getFieldValue(record, key).toLowerCase().includes(term.toLowerCase())
                )
            );
        };

        const results: any = getEmptyResults();

        // Process jobs
        const jobFields = ['job_title', 'title', 'company_name', 'organization_name', 'location', 'description', 'id',
            'skills', 'requirements', 'organization.website'];
        if (jobsRes.status === 'fulfilled') {
            try {
                const data = jobsRes.value;
                const jobs = data.jobs || data || [];
                results.jobs = jobs
                    .filter((job: any) => recordMatchesTerms(job, [...jobFields, 'record_number', 'recordNumber']))
                    .slice(0, perEntityLimit);
            } catch (e) {
                console.error('Error processing jobs results:', e);
            }
        }

        // Process leads
        const leadFields = ['name', 'first_name', 'last_name', 'company_name', 'email', 'phone', 'id', 
            'organization.name', 'organization.website'];
        if (leadsRes.status === 'fulfilled') {
            try {
                const data = leadsRes.value;
                const leads = data.leads || data || [];
                results.leads = Array.isArray(leads)
                    ? leads.filter((lead: any) => recordMatchesTerms(lead, [...leadFields, 'record_number', 'recordNumber'])).slice(0, perEntityLimit)
                    : leads;
            } catch (e) {
                console.error('Error processing leads results:', e);
            }
        }

        // Process job seekers
        const jobSeekerFields = ['first_name', 'last_name', 'name', 'email', 'phone', 'title', 'id',
            'skills', 'current_position', 'location'];
        if (jobSeekersRes.status === 'fulfilled') {
            try {
                const data = jobSeekersRes.value;
                const jobSeekers = data.jobSeekers || data || [];
                results.jobSeekers = jobSeekers
                    .filter((js: any) => recordMatchesTerms(js, [...jobSeekerFields, 'record_number', 'recordNumber']))
                    .slice(0, perEntityLimit);
            } catch (e) {
                console.error('Error processing job seekers results:', e);
            }
        }

        // Process organizations
        const orgFields = ['name', 'website', 'phone', 'address', 'overview', 'id',
            'industry', 'notes'];
        if (organizationsRes.status === 'fulfilled') {
            try {
                const data = organizationsRes.value;
                const organizations = data.organizations || data || [];
                results.organizations = organizations
                    .filter((org: any) => recordMatchesTerms(org, [...orgFields, 'record_number', 'recordNumber']))
                    .slice(0, perEntityLimit);
            } catch (e) {
                console.error('Error processing organizations results:', e);
            }
        }

        // Process tasks
        const taskFields = ['title', 'task_title', 'description', 'notes', 'id', 'status'];
        if (tasksRes.status === 'fulfilled') {
            try {
                const data = tasksRes.value;
                const tasks = data.tasks || data || [];
                results.tasks = tasks
                    .filter((task: any) => recordMatchesTerms(task, [...taskFields, 'record_number', 'recordNumber']))
                    .slice(0, perEntityLimit);
            } catch (e) {
                console.error('Error processing tasks results:', e);
            }
        }

        // Process hiring managers
        const hmFields = ['name', 'first_name', 'last_name', 'email', 'phone', 'id',
            'organization.name', 'organization_name', 'title', 'department'];
        if (hiringManagersRes.status === 'fulfilled') {
            try {
                const data = hiringManagersRes.value;
                const hiringManagers = data.hiringManagers || data.hiring_managers || data || [];
                results.hiringManagers = (Array.isArray(hiringManagers) ? hiringManagers : [])
                    .filter((hm: any) => recordMatchesTerms(hm, [...hmFields, 'record_number', 'recordNumber']))
                    .slice(0, perEntityLimit);
            } catch (e) {
                console.error('Error processing hiring managers results:', e);
            }
        }

        // Process placements
        const placementFields = ['job_title', 'jobSeekerName', 'job_seeker_name', 'status', 'id',
            'organization.name', 'organization_name', 'notes'];
        if (placementsRes.status === 'fulfilled') {
            try {
                const data = placementsRes.value;
                const placements = data.placements || data || [];
                results.placements = (Array.isArray(placements) ? placements : [])
                    .filter((placement: any) => recordMatchesTerms(placement, [...placementFields, 'record_number', 'recordNumber']))
                    .slice(0, perEntityLimit);
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

function getEmptyResults() {
    return {
        jobs: [],
        leads: [],
        jobSeekers: [],
        organizations: [],
        tasks: [],
        hiringManagers: [],
        placements: []
    };
}
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Global search across all entities
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('query');

        if (!query || query.trim().length < 2) {
            return NextResponse.json(
                { success: false, message: 'Search query must be at least 2 characters long' },
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

        // Search across all entities in parallel
        const [jobsRes, leadsRes, jobSeekersRes, organizationsRes, tasksRes] = await Promise.allSettled([
            // Jobs - fetch all and filter
            fetch(`${apiUrl}/api/jobs`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(res => res.ok ? res.json() : { jobs: [] }).catch(() => ({ jobs: [] })),
            
            // Leads - use search endpoint
            fetch(`${apiUrl}/api/leads/search/query?query=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(res => res.ok ? res.json() : { leads: [] }).catch(() => ({ leads: [] })),
            
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
            }).then(res => res.ok ? res.json() : { tasks: [] }).catch(() => ({ tasks: [] }))
        ]);

        const results: any = {
            jobs: [],
            leads: [],
            jobSeekers: [],
            organizations: [],
            tasks: []
        };

        // Helper function to check if a value matches search term
        const matchesSearch = (value: any): boolean => {
            if (!value) return false;
            return String(value).toLowerCase().includes(searchTerm);
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
                    matchesSearch(job.id)
                );
            } catch (e) {
                console.error('Error processing jobs results:', e);
            }
        }

        // Process leads results (already filtered by backend)
        if (leadsRes.status === 'fulfilled') {
            try {
                const data = leadsRes.value;
                results.leads = data.leads || [];
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
                    matchesSearch(js.id)
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
                    matchesSearch(org.id)
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
                    matchesSearch(task.id)
                );
            } catch (e) {
                console.error('Error processing tasks results:', e);
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


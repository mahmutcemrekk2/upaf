import { supabase } from '../lib/supabaseClient';

export const projectService = {
  // Yeni proje oluştur
  async createProject({ name, type, environments, gitConfig, authMethods }) {
    try {
      // 1. Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('You must be logged in to create a project');

      // 2. Insert into projects
      const { data, error } = await supabase
        .from('projects')
        .insert([
          {
            user_id: user.id,
            name,
            type,
            environments,
            git_provider: gitConfig?.provider || 'github',
            git_repo_url: gitConfig?.repoUrl || '',
            git_branch: gitConfig?.branch || 'main',
            git_token: gitConfig?.token || '',
            auth_methods: authMethods || [],
            status: 'Healthy'
          }
        ])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating project:', error);
      return { data: null, error };
    }
  },

  // Kullanıcının projelerini getir
  async getProjects() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching projects:', error);
      return { data: null, error };
    }
  },

  async updateProject(id, { name, type, environments, gitConfig, authMethods }) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update({
          name,
          type,
          environments,
          git_provider: gitConfig?.provider || 'github',
          git_repo_url: gitConfig?.repoUrl || '',
          git_branch: gitConfig?.branch || 'main',
          git_token: gitConfig?.token || '',
          auth_methods: authMethods || []
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error updating project:', error);
      return { data: null, error };
    }
  },

  async deleteProject(id) {
    try {
      // 1. Get test cases of the project
      const { data: testCases, error: tcFetchError } = await supabase
        .from('test_cases')
        .select('id')
        .eq('project_id', id);

      if (tcFetchError) throw tcFetchError;

      // 2. Delete test steps if there are test cases
      if (testCases && testCases.length > 0) {
        const testCaseIds = testCases.map(tc => tc.id);
        const { error: stepsDeleteError } = await supabase
          .from('test_steps')
          .delete()
          .in('test_case_id', testCaseIds);

        if (stepsDeleteError) throw stepsDeleteError;
      }

      // 3. Delete test cases
      const { error: tcDeleteError } = await supabase
        .from('test_cases')
        .delete()
        .eq('project_id', id);

      if (tcDeleteError) throw tcDeleteError;

      // 4. Delete the project itself
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting project:', error);
      return { error };
    }
  }
};

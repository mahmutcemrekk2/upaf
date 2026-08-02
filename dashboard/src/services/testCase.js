import { supabase } from '../lib/supabaseClient';

export const testCaseService = {
  async getTestCases(projectId) {
    const { data, error } = await supabase
      .from('test_cases')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    return { data, error };
  },

  async createTestCase(projectId, name = 'New Test Case') {
    const { data, error } = await supabase
      .from('test_cases')
      .insert([{ project_id: projectId, name }])
      .select()
      .single();
    return { data, error };
  },

  async getSteps(testCaseId) {
    const { data, error } = await supabase
      .from('test_steps')
      .select('*')
      .eq('test_case_id', testCaseId)
      .order('order_index', { ascending: true });
      
    if (data) {
      const mappedData = data.map(step => ({
        ...step,
        authMethod: step.locator?.authMethod || ''
      }));
      return { data: mappedData, error };
    }
    return { data, error };
  },

  async saveSteps(testCaseId, steps) {
    try {
      // 1. Önce silmeyi dene
      const { error: deleteError } = await supabase
        .from('test_steps')
        .delete()
        .eq('test_case_id', testCaseId);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        return { error: deleteError };
      }

      if (steps.length === 0) return { error: null };

      // 2. Yeni adımları hazırla
      const stepsToInsert = steps.map((step, index) => ({
        test_case_id: testCaseId,
        action: step.action,
        locator: {
          ...(step.locator || {}),
          authMethod: step.authMethod || ''
        },
        value: step.value || '',
        headers: step.headers || '',
        params: step.params || '',
        description: step.description || '',
        order_index: index
      }));

      // 3. Insert at
      const { error: insertError } = await supabase
        .from('test_steps')
        .insert(stepsToInsert);

      if (insertError) {
        console.error('Insert error:', insertError);
        return { error: insertError };
      }

      return { error: null };
    } catch (error) {
      console.error('Catch error:', error);
      return { error };
    }
  },

  async updateTestCaseName(testCaseId, name) {
    const { data, error } = await supabase
      .from('test_cases')
      .update({ name })
      .eq('id', testCaseId)
      .select()
      .single();
    return { data, error };
  },

  async deleteTestCase(testCaseId) {
    const { error } = await supabase
      .from('test_cases')
      .delete()
      .eq('id', testCaseId);
    return { error };
  }
};

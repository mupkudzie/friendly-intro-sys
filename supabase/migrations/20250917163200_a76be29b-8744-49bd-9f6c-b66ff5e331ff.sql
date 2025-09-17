-- Create trigger for task completion notifications
CREATE TRIGGER handle_task_completion_trigger
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_completion();

-- Create trigger for task report notifications  
CREATE TRIGGER handle_task_report_notification_trigger
  AFTER INSERT ON public.task_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_report_notification();

-- Create trigger for task request notifications
CREATE TRIGGER handle_task_request_trigger
  AFTER INSERT ON public.task_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_request();
export default function StatusDot({ status }) {
  const colorMap = {
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    neutral: 'bg-border',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colorMap[status] || colorMap.neutral}`} />;
}
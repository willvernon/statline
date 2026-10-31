import { Link } from 'react-router'
import { Shell } from '../components/Shell.tsx'

export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <Shell variant="detail">
      <div className="empty">
        <h1 className="display">No such {what}</h1>
        <p className="muted-2">It may not have played through this week yet.</p>
        <Link className="btn-dark" to="/">Back to receivers</Link>
      </div>
    </Shell>
  )
}

import { getActiveTenant } from '@/lib/tenant'
import { getSessionUser } from '@/lib/session'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'

const KPI_TILES = [
  { label: 'Questions', hint: 'in your question bank' },
  { label: 'Quiz events', hint: 'created so far' },
  { label: 'Students', hint: 'enrolled' },
  { label: 'Badges awarded', hint: 'across all events' },
] as const

export default async function DashboardPage() {
  const tenant = await getActiveTenant()
  const user = await getSessionUser()

  const greetingName = user?.name?.split(' ')[0] ?? null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1B1F23]">
          Welcome to {tenant?.name ?? 'GoalKeepers'}
        </h1>
        <p className="mt-1 text-[#64748b]">
          {greetingName
            ? `Good to see you, ${greetingName}. `
            : 'Good to see you. '}
          Here is a snapshot of your quiz program.
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_TILES.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-[#64748b]">
                {tile.label}
              </p>
              <p className="mt-2 text-3xl font-bold text-[#1B1F23]">-</p>
              <p className="mt-1 text-xs text-[#94a3b8]">{tile.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Placeholder note */}
      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
          <CardDescription>
            Your question bank and quiz events will appear here.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}

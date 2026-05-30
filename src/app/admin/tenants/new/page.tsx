import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTenantAction } from '../../actions'

export default function NewTenantPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#64748b] transition-colors hover:text-[#7E2D8E]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tenants
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>New tenant</CardTitle>
          <CardDescription>
            Provision a school and its first admin account. The school gets
            an isolated workspace on its own subdomain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTenantAction} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">School name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                autoComplete="off"
                placeholder="Sunrise Public School"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug">Subdomain slug</Label>
              <Input
                id="slug"
                name="slug"
                type="text"
                required
                autoComplete="off"
                placeholder="sunrise"
              />
              <p className="text-xs text-[#64748b]">
                lowercase letters, numbers, hyphens - becomes
                &lt;slug&gt;.goalkeepers.app
              </p>
            </div>

            <div className="space-y-4 rounded-xl border border-[#F2F4F7] bg-[#F2F4F7]/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                Tenant admin
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="adminName">Admin name</Label>
                <Input
                  id="adminName"
                  name="adminName"
                  type="text"
                  required
                  autoComplete="off"
                  placeholder="Priya Sharma"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adminEmail">Admin email</Label>
                <Input
                  id="adminEmail"
                  name="adminEmail"
                  type="email"
                  required
                  autoComplete="off"
                  placeholder="principal@sunrise.edu"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adminPassword">Initial password</Label>
                <Input
                  id="adminPassword"
                  name="adminPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                />
                <p className="text-xs text-[#64748b]">min 8 chars</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <Button asChild variant="ghost">
                <Link href="/admin">Cancel</Link>
              </Button>
              <Button type="submit">Create tenant</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

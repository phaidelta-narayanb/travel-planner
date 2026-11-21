export type Trip = {
  id: string
  name: string
  destination: string
  startDate: string
  endDate: string
  color: string
  image: string
  note?: string
}

export type PlanEvent = {
  id: string
  tripId: string
  title: string
  type: 'flight' | 'stay' | 'activity' | 'task' | 'place'
  start: string
  end?: string
  location?: string
  note?: string
}

export type PlannerData = { trips: Trip[]; events: PlanEvent[] }

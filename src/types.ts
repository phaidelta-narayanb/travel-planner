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

export type DestinationPreferences = {
  departure_region?: string
  destination?: string
  start_date?: string
  end_date?: string
  budget?: 'budget' | 'moderate' | 'premium' | 'luxury' | 'flexible'
  interests?: string[]
  travel_pace?: 'relaxed' | 'balanced' | 'packed'
  travel_party?: string
  notes?: string
}

export type DestinationSuggestion = {
  trip_name: string
  destination: string
  overview: string
  why_it_fits: string
  seasonal_fit: string
  ideal_duration_days: number
  recommended_focus_areas: ItineraryFocus[]
}

export type ItineraryFocus = 'activities' | 'sightseeing' | 'transport' | 'stays' | 'food' | 'shopping'

export type DestinationSuggestionsResponse = {
  summary: string
  current_date: string
  suggestions: DestinationSuggestion[]
  notice: string
}

export type ProposedChange = {
  change_id: string
  action: 'add' | 'update' | 'remove'
  event_id: string | null
  event: PlanEvent | null
  summary: string
  rationale: string
}

export type ItineraryProposalResponse = {
  summary: string
  changes: ProposedChange[]
  notice: string
}

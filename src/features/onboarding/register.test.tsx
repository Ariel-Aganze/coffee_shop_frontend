/**
 * Registration wizard and currency picker, through the real app against a
 * fake API answering in the backend's error envelope.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tokens } from '@/lib/api/tokens'
import { fixtures, json, mockApi, shellHandlers } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

type User = ReturnType<typeof renderApp>['user']

const publicHandlers = {
  'GET /api/settings/currencies/': () => json(fixtures.currencies),
}

beforeEach(() => {
  localStorage.clear()
  tokens.clear()
})
afterEach(() => tokens.clear())

async function continueTo(user: User, heading: string) {
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  return screen.findByRole('heading', { name: heading })
}

async function fillAll(user: User) {
  await user.type(await screen.findByLabelText('Business name'), 'Inzozi Coffee')
  await continueTo(user, 'Your owner account')
  await user.type(screen.getByLabelText('First name'), 'Jeanne')
  await user.type(screen.getByLabelText('Last name'), 'Uwera')
  await user.type(screen.getByLabelText('Username'), 'jeanne')
  await user.type(screen.getByLabelText('Email'), 'jeanne@inzozi.example')
  await user.type(screen.getByLabelText('Password'), 'Espresso-Shot-42')
  await user.type(screen.getByLabelText('Confirm password'), 'Espresso-Shot-42')
  await continueTo(user, 'Currency and region')
  await user.click(await screen.findByRole('radio', { name: /RWF/ }))
  await continueTo(user, 'Your first branch')
  await user.type(screen.getByLabelText('Branch name'), 'Kimihurura')
  await continueTo(user, 'Check and create')
}

describe('registration wizard', () => {
  it('validates each step before moving on', async () => {
    mockApi(publicHandlers)
    const { user } = renderApp('/register')
    await screen.findByRole('heading', { name: 'Your business' })
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByText('This field is required.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your business' })).toBeInTheDocument()
  })

  it('moves focus to each new step heading', async () => {
    mockApi(publicHandlers)
    const { user } = renderApp('/register')
    await user.type(await screen.findByLabelText('Business name'), 'Inzozi Coffee')
    expect(await continueTo(user, 'Your owner account')).toHaveFocus()
  })

  it('creates the business, signs the owner in and opens the dashboard', async () => {
    const owner = fixtures.user('owner', { username: 'jeanne' })
    const calls = mockApi({
      ...publicHandlers,
      ...shellHandlers(owner),
      'POST /api/businesses/register/': () => json({ business: {}, branch: {}, settings: {} }, 201),
      'POST /api/auth/login/': () => json({ access: 'a', refresh: 'r', user: owner }),
    })
    const { router, user } = renderApp('/register')
    await fillAll(user)

    const review = screen.getByRole('heading', { name: 'Check and create' }).closest('form')!
    expect(within(review).getByText('Inzozi Coffee')).toBeInTheDocument()
    expect(within(review).getByText('RWF')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create my business' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'))

    const sent = await calls.find((c) => c.path === '/api/businesses/register/')!.request.json()
    expect(sent.owner).toEqual({
      first_name: 'Jeanne',
      last_name: 'Uwera',
      username: 'jeanne',
      email: 'jeanne@inzozi.example',
      password: 'Espresso-Shot-42', // confirm field is not sent
    })
    expect(sent.settings).toMatchObject({ currency_code: 'RWF', language: 'en' })
    expect(sent.first_branch.name).toBe('Kimihurura')
    const login = await calls.find((c) => c.path === '/api/auth/login/')!.request.json()
    expect(login).toEqual({ username: 'jeanne', password: 'Espresso-Shot-42' })
  })

  it('sends the user back to the step with a server error, shown on the field', async () => {
    mockApi({
      ...publicHandlers,
      'POST /api/businesses/register/': () =>
        json(
          {
            error: 'Validation error',
            details: { owner: { username: ['This username is already taken.'] } },
          },
          400,
        ),
    })
    const { user } = renderApp('/register')
    await fillAll(user)
    await user.click(screen.getByRole('button', { name: 'Create my business' }))
    expect(await screen.findByRole('heading', { name: 'Your owner account' })).toHaveFocus()
    expect(screen.getByText('This username is already taken.')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true')
  })
})

async function openRegionStep(user: User) {
  await user.type(await screen.findByLabelText('Business name'), 'Inzozi Coffee')
  await continueTo(user, 'Your owner account')
  await user.type(screen.getByLabelText('Username'), 'jeanne')
  await user.type(screen.getByLabelText('Email'), 'jeanne@inzozi.example')
  await user.type(screen.getByLabelText('Password'), 'Espresso-Shot-42')
  await user.type(screen.getByLabelText('Confirm password'), 'Espresso-Shot-42')
  await continueTo(user, 'Currency and region')
}

describe('currency picker', () => {
  it('searches by code, name and country; lists shared currencies once', async () => {
    mockApi(publicHandlers)
    const { user } = renderApp('/register')
    await openRegionStep(user)
    const group = screen.getByRole('group', { name: 'Currency' })
    expect(await within(group).findAllByRole('radio')).toHaveLength(4)
    const search = within(group).getByRole('searchbox')

    await user.type(search, 'kenya')
    expect(
      within(group)
        .getAllByRole('radio')
        .map((r) => (r as HTMLInputElement).value),
    ).toEqual(['KES'])
    await user.clear(search)
    await user.type(search, 'usd')
    expect(
      within(group)
        .getAllByRole('radio')
        .map((r) => (r as HTMLInputElement).value),
    ).toEqual(['USD'])
    await user.clear(search)
    await user.type(search, 'zzz')
    expect(within(group).getByText('No currency matches “zzz”.')).toBeInTheDocument()
  })

  it('blocks the step until a currency is chosen', async () => {
    mockApi(publicHandlers)
    const { user } = renderApp('/register')
    await openRegionStep(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByText('Choose the currency you sell in.')).toBeInTheDocument()
  })
})

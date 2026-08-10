import { NavLink, Outlet } from 'react-router-dom';

const links = [
	{ to: '/', label: 'Diary', end: true },
	{ to: '/ingredients', label: 'Ingredients', end: false },
	{ to: '/meals', label: 'Meals', end: false },
	{ to: '/weight', label: 'Weight', end: false },
] as const;

export function Layout() {
	return (
		<div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-16 pt-6 sm:px-6 lg:px-8">
			<header className="animate-fade-up mb-10">
				<p className="font-display text-3xl font-extrabold tracking-tight text-leaf sm:text-4xl">
					Health Tracker
				</p>
				<nav className="mt-6 flex flex-wrap gap-1 border-b border-line pb-px" aria-label="Primary">
					{links.map((link) => (
						<NavLink
							key={link.to}
							to={link.to}
							end={link.end}
							className={({ isActive }) =>
								[
									'relative px-3 py-2 text-sm font-semibold transition-colors duration-200',
									isActive ? 'text-leaf' : 'text-ink-soft hover:text-ink',
								].join(' ')
							}
						>
							{({ isActive }) => (
								<>
									{link.label}
									<span
										className={[
											'absolute inset-x-2 -bottom-px h-0.5 origin-left rounded-full bg-leaf transition-transform duration-300',
											isActive ? 'scale-x-100' : 'scale-x-0',
										].join(' ')}
										aria-hidden
									/>
								</>
							)}
						</NavLink>
					))}
				</nav>
			</header>
			<main className="animate-fade-up flex-1 [animation-delay:80ms]">
				<Outlet />
			</main>
		</div>
	);
}

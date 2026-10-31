-- Grain: one row per season.
-- thru_week = the last regular-season week where every game is final.
-- League-wide gate: one unfinished game (e.g. MNF) holds the whole week back.
with
    games as (
        select
            season,
            week,
            result
        from
            {{ ref('dim_game') }}
        where
            game_type = 'REG'
    ),
    weekly as (
        select
            season,
            week,
            count(*) as n_games,
            count(result) as n_final
        from
            games
        group by
            season,
            week
    )
select
    season,
    coalesce(
        min(week) filter (where n_games != n_final) - 1,
        max(week)
    ) as thru_week
from
    weekly
group by
    season

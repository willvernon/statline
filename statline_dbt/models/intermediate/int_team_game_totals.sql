-- team totals, offense and defense
select
    *
from
    {{ref ('fact_team_game')}}
